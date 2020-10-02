import { Model, QuerySet, ORM, attr, many, fk, Session } from "../..";
import { ModelId, TableRow } from "../../types";
import {
  createTestSessionWithData,
  ExtendedSession,
  IManyQuerySet,
  TagProps,
} from "../helpers";

function typedCast<T>(arg: Model): T {
  return (arg as unknown) as typeof Model & T;
}

class User extends Model {
  static modelName = "User";
  static fields = {
    id: attr(),
    name: attr(),
    subscribed: many("User", "subscribers"),
  };
}

type UserProps = {
  id: ModelId;
  name: string;
  subscribed: IManyQuerySet<typeof User & UserProps>;
  subscribers: IManyQuerySet<typeof User & UserProps>;
  teams: IManyQuerySet<typeof Team & TeamProps>;
};

class Team extends Model {
  static modelName = "Team";
  static fields = {
    id: attr(),
    name: attr(),
    users: many("User", "teams"),
  };
}

type TeamProps = {
  id: ModelId;
  name: string;
  users: IManyQuerySet<typeof User & UserProps>;
};

type CustomSession = {
  User: typeof User;
  Team: typeof Team;
  TeamUsers: typeof Model;
};

describe("Many to many relationships", () => {
  let session: Session;
  let orm: ORM;

  describe("many-many forward/backward updates", () => {
    let session: CustomSession;
    let teamFirst: Model;
    let userFirst: Model;
    let userLast: Model;
    let validateRelationState: () => void;

    beforeEach(() => {
      const MyUser = class extends User {};
      const MyTeam = class extends Team {};

      orm = new ORM();
      orm.register(MyUser, MyTeam);
      session = (orm.session() as unknown) as CustomSession;

      session.Team.create({ name: "team0" });
      session.Team.create({ name: "team1" });

      session.User.create({ name: "user0" });
      session.User.create({ name: "user1" });
      session.User.create({ name: "user2" });

      teamFirst = session.Team.first() as Model;
      userFirst = session.User.first() as Model;
      userLast = session.User.last() as Model;

      validateRelationState = () => {
        const { TeamUsers } = session;

        teamFirst = session.Team.first()!;
        userFirst = session.User.first()!;
        userLast = session.User.last()!;

        expect(
          ((teamFirst as unknown) as TeamProps).users
            .toRefArray()
            .map((row: TableRow) => row.id)
        ).toEqual([
          typedCast<UserProps>(userFirst).id,
          typedCast<UserProps>(userLast).id,
        ]);
        expect(
          typedCast<UserProps>(userFirst)
            .teams.toRefArray()
            .map((row: TableRow) => row.id)
        ).toEqual([typedCast<UserProps>(teamFirst).id]);
        expect(
          typedCast<UserProps>(userLast)
            .teams.toRefArray()
            .map((row: TableRow) => row.id)
        ).toEqual([typedCast<UserProps>(teamFirst).id]);

        expect(TeamUsers.count()).toBe(2);
      };
    });

    it("add forward many-many field", () => {
      typedCast<TeamProps>(teamFirst).users.add(
        (userFirst as unknown) as typeof User & UserProps,
        (userLast as unknown) as typeof User & UserProps
      );
      validateRelationState();
    });

    it("update forward many-many field", () => {
      teamFirst.update({ users: [userFirst, userLast] });
      validateRelationState();
    });

    it("add backward many-many field", () => {
      typedCast<UserProps>(userFirst).teams.add(
        (teamFirst as unknown) as typeof Team & TeamProps
      );
      typedCast<UserProps>(userLast).teams.add(
        (teamFirst as unknown) as typeof Team & TeamProps
      );
      validateRelationState();
    });

    it("update backward many-many field", () => {
      userFirst.update({ teams: [teamFirst] });
      userLast.update({ teams: [teamFirst] });
      validateRelationState();
    });

    it("create with forward many-many field", () => {
      session.Team.all().delete();
      session.User.all().delete();
      expect(session.Team.count()).toBe(0);
      expect(session.User.count()).toBe(0);
      expect(session.TeamUsers.count()).toBe(0);

      session.User.create({ name: "user0" });
      session.User.create({ name: "user1" });
      session.User.create({ name: "user2" });

      session.Team.create({
        name: "team0",
        users: [session.User.first(), session.User.last()],
      });
      session.Team.create({ name: "team1" });

      validateRelationState();
    });

    it("create with backward many-many field", () => {
      session.Team.all().delete();
      session.User.all().delete();
      expect(session.Team.count()).toBe(0);
      expect(session.User.count()).toBe(0);
      expect(session.TeamUsers.count()).toBe(0);

      session.Team.create({ name: "team0" });
      session.Team.create({ name: "team1" });

      session.User.create({ name: "user0", teams: [session.Team.first()] });
      session.User.create({ name: "user1" });
      session.User.create({ name: "user2", teams: [session.Team.first()] });

      validateRelationState();
    });

    it("create with forward field with future many-many", () => {
      session.Team.all().delete();
      session.User.all().delete();
      expect(session.Team.count()).toBe(0);
      expect(session.User.count()).toBe(0);
      expect(session.TeamUsers.count()).toBe(0);

      session.Team.create({ id: "t0", users: ["u0", "u2"] });
      session.Team.create({ id: "t1" });

      session.User.create({ id: "u0" });
      session.User.create({ id: "u1" });
      session.User.create({ id: "u2" });

      validateRelationState();
    });

    it("create with backward field with future many-many", () => {
      session.Team.all().delete();
      session.User.all().delete();
      expect(session.Team.count()).toBe(0);
      expect(session.User.count()).toBe(0);
      expect(session.TeamUsers.count()).toBe(0);

      session.User.create({ id: "u0", teams: ["t0"] });
      session.User.create({ id: "u1" });
      session.User.create({ id: "u2", teams: ["t0"] });

      session.Team.create({ id: "t0" });
      session.Team.create({ id: "t1" });

      validateRelationState();
    });

    it("create with forward field and existing backward many-many", () => {
      session.Team.all().delete();
      session.User.all().delete();
      expect(session.Team.count()).toBe(0);
      expect(session.User.count()).toBe(0);
      expect(session.TeamUsers.count()).toBe(0);

      session.User.create({ id: "u0", teams: ["t0"] });
      session.User.create({ id: "u1" });
      session.User.create({ id: "u2", teams: ["t0"] });

      session.Team.create({ id: "t0", users: ["u0", "u2"] });
      session.Team.create({ id: "t1" });

      validateRelationState();
    });

    it("create with backward field and existing forward many-many", () => {
      session.Team.all().delete();
      session.User.all().delete();
      expect(session.Team.count()).toBe(0);
      expect(session.User.count()).toBe(0);
      expect(session.TeamUsers.count()).toBe(0);

      session.Team.create({ id: "t0", users: ["u0", "u2"] });
      session.Team.create({ id: "t1" });

      session.User.create({ id: "u0", teams: ["t0"] });
      session.User.create({ id: "u1" });
      session.User.create({ id: "u2", teams: ["t0"] });

      validateRelationState();
    });
  });

  describe("many-many with a custom through model", () => {
    let validateRelationState: () => void;

    beforeEach(() => {
      validateRelationState = () => {
        const { User, Team, User2Team } = (session as unknown) as {
          User: typeof Model;
          Team: typeof Model;
          User2Team: typeof Model;
        };

        // Forward (from many-to-many field declaration)
        const user = User.get({ name: "user0" });
        const { teams: relatedTeams } = typedCast<UserProps>(user!);
        expect(relatedTeams).toBeInstanceOf(QuerySet);
        expect(relatedTeams.modelClass).toBe(Team);
        expect(relatedTeams.count()).toBe(1);

        // Backward
        const team = Team.get({ name: "team0" })!;
        const { users: relatedUsers } = (team as unknown) as TeamProps;
        expect(relatedUsers).toBeInstanceOf(QuerySet);
        expect(relatedUsers.modelClass).toBe(User);
        expect(relatedUsers.count()).toBe(2);

        expect(
          relatedUsers.toRefArray().map((row: TableRow) => row.id)
        ).toEqual(["u0", "u1"]);
        expect(
          typedCast<TeamProps>(Team.withId("t2")!)
            .users.toRefArray()
            .map((row: TableRow) => row.id)
        ).toEqual(["u1"]);

        expect(
          relatedTeams.toRefArray().map((row: TableRow) => row.id)
        ).toEqual([typedCast<TeamProps>(team!).id]);
        expect(
          typedCast<UserProps>(User.withId("u1")!)
            .teams.toRefArray()
            .map((row: TableRow) => row.id)
        ).toEqual(["t0", "t2"]);

        expect(User2Team.count()).toBe(3);
      };
    });

    it("without throughFields", () => {
      class UserModel extends Model {
        static modelName = "User";
        static fields = {
          id: attr(),
          name: attr(),
        };
      }

      class User2TeamModel extends Model {
        static modelName = "User2Team";
        static fields = {
          id: attr(),
          user: fk("User"),
          team: fk("Team"),
        };
      }

      class TeamModel extends Model {
        static modelName = "Team";
        static fields = {
          id: attr(),
          name: attr(),
          users: many({
            to: "User",
            through: "User2Team",
            relatedName: "teams",
          }),
        };
      }

      orm = new ORM();
      orm.register(UserModel, TeamModel, User2TeamModel);
      session = orm.session(orm.getEmptyState());
      const { User, Team } = (session as unknown) as {
        User: typeof Model;
        Team: typeof Model;
      };

      Team.create({ id: "t0", name: "team0" });
      Team.create({ id: "t1", name: "team1" });
      Team.create({ id: "t2", name: "team2" });

      User.create({ id: "u0", name: "user0", teams: ["t0"] });
      User.create({ id: "u1", name: "user1", teams: ["t0", "t2"] });

      validateRelationState();
    });

    it("with throughFields", () => {
      class UserModel extends Model {
        static modelName = "User";
        static fields = {
          id: attr(),
          name: attr(),
        };
      }

      class User2TeamModel extends Model {
        static modelName = "User2Team";
        static fields = {
          id: attr(),
          user: fk("User"),
          team: fk("Team"),
        };
      }

      class TeamModel extends Model {
        static modelName = "Team";
        static fields = {
          id: attr(),
          name: attr(),
          users: many({
            to: "User",
            through: "User2Team",
            relatedName: "teams",
            throughFields: ["user", "team"],
          }),
        };
      }

      orm = new ORM();
      orm.register(UserModel, TeamModel, User2TeamModel);
      session = orm.session(orm.getEmptyState());
      const { User, Team } = (session as unknown) as {
        User: typeof Model;
        Team: typeof Model;
      };

      Team.create({ id: "t0", name: "team0" });
      Team.create({ id: "t1", name: "team1" });
      Team.create({ id: "t2", name: "team2" });

      User.create({ id: "u0", name: "user0", teams: ["t0"] });
      User.create({ id: "u1", name: "user1", teams: ["t0", "t2"] });

      validateRelationState();
    });

    it("with additional attributes", () => {
      class UserModel extends Model {
        static modelName = "User";
        static fields = {
          id: attr(),
          name: attr(),
        };
      }

      class User2TeamModel extends Model {
        static modelName = "User2Team";
        static fields = {
          id: attr(),
          user: fk("User", "links"),
          team: fk("Team", "links"),
          name: attr(),
        };
      }

      const TeamModel = class extends Model {
        static modelName = "Team";
        static fields = {
          id: attr(),
          name: attr(),
          users: many({
            to: "User",
            through: "User2Team",
            relatedName: "teams",
          }),
        };
      };

      type UserProps = {
        name: string;
        links: IManyQuerySet<typeof Model & TeamProps>;
      }

      type User2TeamProps = {
        user: typeof Model & UserProps;
        team: typeof Model & TeamProps;
        name: string;
      }

      type TeamModel = {
        name: string;
        links: IManyQuerySet<typeof Model & User2TeamProps>;
      };

      orm = new ORM();
      orm.register(UserModel, TeamModel, User2TeamModel);
      session = orm.session(orm.getEmptyState());
      const { User, Team, User2Team } = (session as unknown) as {
        User: typeof Model & UserProps;
        Team: typeof Model & TeamProps;
        User2Team: typeof Model & User2TeamProps;
      };

      Team.create({ id: "t0", name: "team0" });
      Team.create({ id: "t1", name: "team1" });
      Team.create({ id: "t2", name: "team2" });

      User.create({ id: "u0", name: "user0" });
      User.create({ id: "u1", name: "user1" });

      User2Team.create({ user: "u0", team: "t0", name: "link0" });
      User2Team.create({ user: "u1", team: "t0", name: "link1" });
      User2Team.create({ user: "u1", team: "t2", name: "link2" });

      validateRelationState();

      expect(
        (User.withId("u0")! as unknown as UserProps)
          .links.toRefArray()
          .map((row: TableRow) => row.name)
      ).toEqual(["link0"]);
      expect(
        (User.withId("u1")! as unknown as UserProps)
          .links.toRefArray()
          .map((row: TableRow) => row.name)
      ).toEqual(["link1", "link2"]);
    });

    it("throws if self-referencing relationship without throughFields", () => {
      class UserModel extends Model {
        static modelName = "User";
        static fields = {
          id: attr(),
          name: attr(),
          users: many({
            to: "User",
            through: "User2User",
            relatedName: "otherUsers",
          }),
        };
      }

      const User2UserModel = class extends Model {};
      User2UserModel.modelName = "User2User";
      User2UserModel.fields = {
        id: attr(),
        name: attr(),
      };

      orm = new ORM();
      expect(() => {
        orm.register(UserModel, User2UserModel);
      }).toThrow(
        'Self-referencing many-to-many relationship at "User.users" using custom model "User2User" has no throughFields key. Cannot determine which fields reference the instances partaking in the relationship.'
      );
    });
  });

  describe('self-referencing many field with "this" as toModelName', () => {
    beforeEach(() => {
      ({ session, orm } = createTestSessionWithData());
    });

    it('adds relationships correctly when toModelName is "this"', () => {
      const { Tag, TagSubTags } = session as ExtendedSession;
      expect(TagSubTags.count()).toBe(0);
      ((Tag.withId("Technology")! as unknown) as TagProps).subTags.add("Redux");
      expect(TagSubTags.all().toRefArray()).toEqual([
        {
          id: 0,
          fromTagId: "Technology",
          toTagId: "Redux",
        },
      ]);
      expect(
        ((Tag.withId("Technology")! as unknown) as TagProps).subTags.count()
      ).toBe(1);
      expect(
        ((Tag.withId(
          "Technology"
        )! as unknown) as TagProps).subTags.toRefArray()
      ).toEqual([Tag.withId("Redux")!.ref]);

      expect(
        ((Tag.withId("Redux")! as unknown) as TagProps).subTags.count()
      ).toBe(0);
      expect(
        ((Tag.withId("Redux")! as unknown) as TagProps).subTags.toRefArray()
      ).toEqual([]);
    });

    it('removes relationships correctly when toModelName is "this"', () => {
      const { Tag, TagSubTags } = (session as unknown) as {
        Tag: typeof Model;
        TagSubTags: typeof Model;
      };
      ((Tag.withId("Technology")! as unknown) as TagProps).subTags.add("Redux");
      ((Tag.withId("Redux")! as unknown) as TagProps).subTags.add("Technology");

      ((Tag.withId("Redux")! as unknown) as TagProps).subTags.remove(
        "Technology"
      );

      expect(
        ((Tag.withId(
          "Technology"
        )! as unknown) as TagProps).subTags.toRefArray()
      ).toEqual([Tag.withId("Redux")!.ref]);
      expect(TagSubTags.all().toRefArray()).toEqual([
        {
          id: 0,
          fromTagId: "Technology",
          toTagId: "Redux",
        },
      ]);
      expect(
        ((Tag.withId("Technology")! as unknown) as TagProps).subTags.count()
      ).toBe(1);
      expect(
        ((Tag.withId("Redux")! as unknown) as TagProps).subTags.toRefArray()
      ).toEqual([]);
      expect(
        ((Tag.withId("Redux")! as unknown) as TagProps).subTags.count()
      ).toBe(0);
    });

    it('querying backwards relationships works when toModelName is "this"', () => {
      const { Tag } = (session as unknown) as { Tag: typeof Model };
      ((Tag.withId("Technology")! as unknown) as TagProps).subTags.add("Redux");

      expect(
        ((Tag.withId("Redux")! as unknown) as TagProps).parentTags.toRefArray()
      ).toEqual([Tag.withId("Technology")!.ref]);
      expect(
        ((Tag.withId("Redux")! as unknown) as TagProps).parentTags.count()
      ).toBe(1);
      expect(
        ((Tag.withId(
          "Technology"
        )! as unknown) as TagProps).parentTags.toRefArray()
      ).toEqual([]);
      expect(
        ((Tag.withId("Technology")! as unknown) as TagProps).parentTags.count()
      ).toBe(0);
    });

    it('adding relationships via backwards descriptor works when toModelName is "this"', () => {
      const { Tag } = (session as unknown) as { Tag: typeof Model };
      ((Tag.withId("Redux")! as unknown) as TagProps).parentTags.add(
        "Technology"
      );

      expect(
        ((Tag.withId("Redux")! as unknown) as TagProps).parentTags.toRefArray()
      ).toEqual([Tag.withId("Technology")!.ref]);
      expect(
        ((Tag.withId("Redux")! as unknown) as TagProps).parentTags.count()
      ).toBe(1);
      expect(
        ((Tag.withId(
          "Technology"
        )! as unknown) as TagProps).subTags.toRefArray()
      ).toEqual([Tag.withId("Redux")!.ref]);
      expect(
        ((Tag.withId("Technology")! as unknown) as TagProps).subTags.count()
      ).toBe(1);
    });

    it('removing relationships via backwards descriptor works when toModelName is "this"', () => {
      const { Tag, TagSubTags } = (session as unknown) as {
        Tag: typeof Model;
        TagSubTags: typeof Model;
      };
      ((Tag.withId("Technology")! as unknown) as TagProps).subTags.add("Redux");
      ((Tag.withId("Redux")! as unknown) as TagProps).subTags.add("Technology");

      ((Tag.withId("Technology")! as unknown) as TagProps).parentTags.remove(
        "Redux"
      );

      expect(
        ((Tag.withId(
          "Technology"
        )! as unknown) as TagProps).subTags.toRefArray()
      ).toEqual([Tag.withId("Redux")!.ref]);
      expect(TagSubTags.all().toRefArray()).toEqual([
        {
          id: 0,
          fromTagId: "Technology",
          toTagId: "Redux",
        },
      ]);
      expect(
        ((Tag.withId("Technology")! as unknown) as TagProps).subTags.count()
      ).toBe(1);
      expect(
        ((Tag.withId("Redux")! as unknown) as TagProps).subTags.toRefArray()
      ).toEqual([]);
      expect(
        ((Tag.withId("Redux")! as unknown) as TagProps).subTags.count()
      ).toBe(0);
    });
  });

  describe("self-referencing many field with modelName as toModelName", () => {
    type UserProps = {
      id: ModelId;
      subscribed: IManyQuerySet<typeof Model & UserProps>;
      subscribers: IManyQuerySet<typeof Model & UserProps>;
    };

    type ExtendedSession = {
      User: typeof Model & UserProps;
      UserSubscribed: typeof Model & UserProps;
    };

    let session: ExtendedSession;
    let user0: Model;
    let user1: Model;
    let user2: Model;
    let validateRelationState: () => void;

    beforeEach(() => {
      class User extends Model {
        static modelName = "User";
        static fields = {
          id: attr(),
          subscribed: many("User", "subscribers"),
        };
      }

      orm = new ORM();
      orm.register(User);
      session = (orm.session() as unknown) as ExtendedSession;

      session.User.create({ id: "u0" });
      session.User.create({ id: "u1" });
      session.User.create({ id: "u2" });

      user0 = session.User.withId("u0")!;
      user1 = session.User.withId("u1")!;
      user2 = session.User.withId("u2")!;

      validateRelationState = () => {
        const { UserSubscribed } = session;

        user0 = session.User.withId("u0")!;
        user1 = session.User.withId("u1")!;
        user2 = session.User.withId("u2")!;

        expect(
          ((user0 as unknown) as UserProps).subscribed
            .toRefArray()
            .map((row: TableRow) => row.id)
        ).toEqual(["u2"]);
        expect(
          ((user1 as unknown) as UserProps).subscribed
            .toRefArray()
            .map((row: TableRow) => row.id)
        ).toEqual(["u0", "u2"]);
        expect(
          ((user2 as unknown) as UserProps).subscribed
            .toRefArray()
            .map((row: TableRow) => row.id)
        ).toEqual(["u1"]);

        expect(UserSubscribed.count()).toBe(4);
      };
    });

    it("add forward many-many field", () => {
      ((user0 as unknown) as UserProps).subscribed.add(
        (user2 as unknown) as typeof Model & UserProps
      );
      ((user1 as unknown) as UserProps).subscribed.add(
        (user0 as unknown) as typeof Model & UserProps,
        (user2 as unknown) as typeof Model & UserProps
      );
      ((user2 as unknown) as UserProps).subscribed.add(
        (user1 as unknown) as typeof Model & UserProps
      );
      validateRelationState();
    });

    it("update forward many-many field", () => {
      user0.update({ subscribed: [user2] });
      user1.update({ subscribed: [user0, user2] });
      user2.update({ subscribed: [user1] });
      validateRelationState();
    });

    it("add backward many-many field", () => {
      ((user0 as unknown) as UserProps).subscribers.add(
        (user1 as unknown) as typeof Model & UserProps
      );
      ((user1 as unknown) as UserProps).subscribers.add(
        (user2 as unknown) as typeof Model & UserProps
      );
      ((user2 as unknown) as UserProps).subscribers.add(
        (user0 as unknown) as typeof Model & UserProps,
        (user1 as unknown) as typeof Model & UserProps
      );
      validateRelationState();
    });

    it("update backward many-many field", () => {
      user0.update({ subscribers: [user1] });
      user1.update({ subscribers: [user2] });
      user2.update({ subscribers: [user0, user1] });
      validateRelationState();
    });

    it("create with forward many-many field", () => {
      session.User.all().delete();
      expect(session.User.count()).toBe(0);
      expect(session.UserSubscribed.count()).toBe(0);

      session.User.create({ id: "u0", subscribed: ["u2"] });
      session.User.create({ id: "u1", subscribed: ["u0", "u2"] });
      session.User.create({ id: "u2", subscribed: ["u1"] });

      validateRelationState();
    });

    it("create with backward many-many field", () => {
      session.User.all().delete();
      expect(session.User.count()).toBe(0);
      expect(session.UserSubscribed.count()).toBe(0);

      session.User.create({ id: "u0", subscribers: ["u1"] });
      session.User.create({ id: "u1", subscribers: ["u2"] });
      session.User.create({ id: "u2", subscribers: ["u0", "u1"] });

      validateRelationState();
    });
  });
});
