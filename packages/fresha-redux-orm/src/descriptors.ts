import { castTo } from "./hacks";
import Model, { AnyModel } from "./Model";
import { ModelId, RefFromFields } from "./types";
import { normalizeEntity } from "./utils";

/**
 * The functions in this file return custom JS property descriptors
 * that are supposed to be assigned to Model fields.
 *
 * Some include the logic to look up models using foreign keys and
 * to add or remove relationships between models.
 *
 * @module descriptors
 */

/**
 * Defines a basic non-key attribute.
 * @param  {string} fieldName - the name of the field the descriptor will be assigned to.
 */
export function attrDescriptor(fieldName: string) {
  return {
    get(): any {
      return (this as unknown as AnyModel)._fields[fieldName as keyof RefFromFields];
    },

    set(value: any): void {
      return (this as unknown as AnyModel).set(fieldName, value);
    },

    enumerable: true,
    configurable: true,
  };
}

/**
 * Forwards direction of a Foreign Key: returns one object.
 * Also works as {@link .forwardsOneToOneDescriptor|forwardsOneToOneDescriptor}.
 *
 * For `book.author` referencing an `Author` model instance,
 * `fieldName` would be `'author'` and `declaredToModelName` would be `'Author'`.
 * @param  {string} fieldName - the name of the field the descriptor will be assigned to.
 * @param  {string} declaredToModelName - the name of the model that the field references.
 */
export function forwardsManyToOneDescriptor<MClass extends AnyModel>(
  fieldName: string,
  declaredToModelName: string
) {
  return {
    get() {
      const thisModel = this as unknown as MClass;
      const DeclaredToModel = thisModel.getClass().session[declaredToModelName];
      const { [fieldName as 'id']: toId } = thisModel._fields;

      return DeclaredToModel.withId(toId!);
    },
    set(value: any) {
      const thisModel = castTo<AnyModel>(this);
      thisModel.update({
        [fieldName]: normalizeEntity(value),
      });
    },
  };
}

/**
 * Dereferencing foreign keys in {@link module:fields.oneToOne|oneToOne}
 * relationships works the same way as in many-to-one relationships:
 * just look up the related model.
 *
 * For example, a human face tends to have a single nose.
 * So if we want to resolve `face.nose`, we need to
 * look up the `Nose` that has the primary key that `face` references.
 *
 * @see {@link module:descriptors~forwardsManyToOneDescriptor|forwardsManyToOneDescriptor}
 */
export function forwardsOneToOneDescriptor(
  fieldName: string,
  declaredToModelName: string
) {
  return forwardsManyToOneDescriptor(fieldName, declaredToModelName);
}

/**
 * Here we resolve 1-to-1 relationships starting at the model on which the
 * field was not installed. This means we need to find the instance of the
 * other model whose {@link module:fields.oneToOne|oneToOne} FK field contains the current model's primary key.
 *
 * @param  {string} declaredFieldName - the name of the field referencing the current model.
 * @param  {string} declaredFromModelName - the name of the other model.
 */
export function backwardsOneToOneDescriptor<MClass extends AnyModel>(
  declaredFieldName: string,
  declaredFromModelName: string
) {
  return {
    get() {
      const thisModel = this as unknown as MClass;
      const DeclaredFromModel = thisModel.getClass().session[declaredFromModelName];

      return DeclaredFromModel.get({
        [declaredFieldName]: thisModel.getId(),
      });
    },
    set() {
      throw new Error("Can't mutate a reverse one-to-one relation.");
    },
  };
}

/**
 * The backwards direction of a n-to-1 relationship (i.e. 1-to-n),
 * meaning this will return an a collection (`QuerySet`) of model instances.
 *
 * An example would be `author.books` referencing all instances of
 * the `Book` model that reference the author using `fk()`.
 */
export function backwardsManyToOneDescriptor<MClass extends AnyModel>(
  declaredFieldName: string,
  declaredFromModelName: string
) {
  return {
    get() {
      const thisModel = this as unknown as MClass;
      const DeclaredFromModel = thisModel.getClass().session[declaredFromModelName];

      return DeclaredFromModel.filter({
        [declaredFieldName]: thisModel.getId(),
      });
    },
    set() {
      throw new Error("Can't mutate a reverse many-to-one relation.");
    },
  };
}

/**
 * This descriptor is assigned to both sides of a many-to-many relationship.
 * To indicate the backwards direction pass `true` for `reverse`.
 */
export function manyToManyDescriptor<MClass extends AnyModel>(
  declaredFromModelName: string,
  declaredToModelName: string,
  throughModelName: string,
  throughFields: { from: string; to: string },
  reverse: boolean
) {
  return {
    get() {
      const thisModel = this as unknown as MClass;
      const session = thisModel.getClass().session;
      const {
        [declaredFromModelName]: DeclaredFromModel,
        [declaredToModelName]: DeclaredToModel,
        [throughModelName]: ThroughModel,
      } = session;

      const ThisModel = reverse ? DeclaredToModel : DeclaredFromModel;
      const OtherModel = reverse ? DeclaredFromModel : DeclaredToModel;

      const thisReferencingField = reverse
        ? throughFields.to
        : throughFields.from;
      const otherReferencingField = reverse
        ? throughFields.from
        : throughFields.to;

      const thisId = thisModel.getId();

      const throughQs = ThroughModel.filter({
        [thisReferencingField]: thisId,
      });

      /**
       * all IDs of instances of the other model that are
       * referenced by any instance of the current model
       */
      const referencedOtherIds = new Set(
        throughQs
          .toRefArray()
          .map(obj => obj[otherReferencingField as keyof RefFromFields])
      );

      /**
       * selects all instances of other model that are referenced
       * by any instance of the current model
       */
      const qs = OtherModel.filter((otherModelInstance) =>
        referencedOtherIds.has(
          otherModelInstance[OtherModel.idAttribute as keyof RefFromFields]
        )
      );

      /**
       * Allows adding OtherModel instances to be referenced by the current instance.
       *
       * E.g. Book.first().authors.add(1, 2) would add the authors with IDs 1 and 2
       * to the first book's list of referenced authors.
       *
       * @return undefined
       */
      qs.add = function add(...entities: (ModelId | AnyModel)[]) {
        const idsToAdd = new Set(entities.map(normalizeEntity));

        const existingQs = throughQs.filter((through) =>
          idsToAdd.has(through[otherReferencingField] as ModelId)
        );

        if (existingQs.exists()) {
          const existingIds = existingQs
            .toRefArray()
            .map(through => through[otherReferencingField as keyof RefFromFields]);

          throw new Error(
            `Tried to add already existing ${OtherModel.modelName} id(s) ${existingIds} to the ${ThisModel.modelName} instance with id ${thisId}`
          );
        }

        idsToAdd.forEach((id) =>
          ThroughModel.create({
            [otherReferencingField]: id,
            [thisReferencingField]: thisId,
          })
        );
      };

      /**
       * Removes references to all OtherModel instances from the current model.
       *
       * E.g. Book.first().authors.clear() would cause the first book's list
       * of referenced authors to become empty.
       *
       * @return undefined
       */
      qs.clear = function clear() {
        throughQs.delete();
      };

      /**
       * Removes references to all passed OtherModel instances from the current model.
       *
       * E.g. Book.first().authors.remove(1, 2) would cause the authors with
       * IDs 1 and 2 to no longer be referenced by the first book.
       *
       * @return undefined
       */
      qs.remove = function remove(...entities: (ModelId | Model)[]): void {
        const idsToRemove = new Set(entities.map(normalizeEntity));

        const entitiesToDelete = throughQs.filter((through) =>
          idsToRemove.has(through[otherReferencingField] as ModelId)
        );

        if (entitiesToDelete.count() !== idsToRemove.size) {
          // Tried deleting non-existing entities.
          const entitiesToDeleteIds = entitiesToDelete
            .toRefArray()
            .map(through => through[otherReferencingField as keyof RefFromFields]);

          const unexistingIds = [...idsToRemove].filter(
            (id) => !entitiesToDeleteIds.includes(id)
          );

          throw new Error(
            `Tried to delete non-existing ${OtherModel.modelName} id(s) ${unexistingIds} from the ${ThisModel.modelName} instance with id ${thisId}`
          );
        }

        entitiesToDelete.delete();
      };

      return qs;
    },

    set() {
      throw new Error(
        "Tried setting a M2M field. Please use the related QuerySet methods add, remove and clear."
      );
    },
  };
}
