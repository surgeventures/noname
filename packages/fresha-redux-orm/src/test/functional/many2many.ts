import { Model, QuerySet, ORM } from "../..";
import { Attribute, ManyToMany, ForeignKey } from "../../decorators";
import { castTo } from "../../hacks";
import { AnyModel } from "../../Model";
import { ModelDescriptorsRegistry } from "../../modelDescriptorsRegistry";
import { ModelId, Relations, SessionWithBoundModels, TargetRelationship, Ref, SourceRelationship, SessionBoundModel, ValidateSchema } from "../../types";
import {
  createTestSessionWithData,
  ExtendedSession,
  Schema,
} from "../helpers";

const registry = ModelDescriptorsRegistry.getInstance();

const createTestModels = () => {
  type UserDescriptors = {
    id?: ModelId;
    name?: string;
    subscribed?: TargetRelationship<User, Relations.ManyToMany>;
    subscribers?: SourceRelationship<typeof User, Relations.ManyToMany>;
    teams?: SourceRelationship<typeof Team, Relations.ManyToMany>;
  };
  
  class User extends Model<typeof User, UserDescriptors> implements UserDescriptors {
    static modelName = "User" as const;
  
    @Attribute()
    public id?: ModelId;
  
    @Attribute()
    public name?: string;
  
    @ManyToMany<User>("User", "subscribers")
    public subscribed?: TargetRelationship<User, Relations.ManyToMany>;
  
    subscribers?: SourceRelationship<typeof User, Relations.ManyToMany>;
    teams?: SourceRelationship<typeof Team, Relations.ManyToMany>;
  }
  
  type TeamDescriptors = {
    id?: ModelId;
    name?: string;
    users?: TargetRelationship<User, Relations.ManyToMany>;
  };
  
  class Team extends Model<typeof Team, TeamDescriptors> implements TeamDescriptors {
    static modelName = "Team" as const;
  
    @Attribute()
    public id?: ModelId;
  
    @Attribute()
    public name?: string;
  
    @ManyToMany<Team>("User", "teams")
    public users?: TargetRelationship<User, Relations.ManyToMany>;
  }

  return {
    Team,
    User,
  }
}


describe("Many to many relationships", () => {
  beforeEach(() => {
    registry.clear();
  })

  describe("many-many forward/backward updates", () => {
    type Schema = {
      User: ReturnType<typeof createTestModels>['User'];
      Team: ReturnType<typeof createTestModels>['Team'];
      TeamUsers: ReturnType<typeof createTestModels>['User'];
      User2Team: typeof AnyModel;
    };

    type CustomSession = SessionWithBoundModels<Schema>;
    let session: CustomSession;
    let teamFirst: SessionBoundModel<InstanceType<Schema['Team']>>;
    let userFirst: SessionBoundModel<InstanceType<Schema['User']>>;
    let userLast: SessionBoundModel<InstanceType<Schema['User']>>;
    let orm: ORM<Schema>;
    let validateRelationState: () => void;

    beforeEach(() => {
      const { User, Team } = createTestModels();
      orm = new ORM<Schema>();
      orm.register(User, Team);
      session = orm.session();

      session.Team.create({ name: "team0" });
      session.Team.create({ name: "team1" });

      session.User.create({ name: "user0" });
      session.User.create({ name: "user1" });
      session.User.create({ name: "user2" });

      teamFirst = session.Team.first()!;
      userFirst = session.User.first()!;
      userLast = session.User.last()!;

      validateRelationState = () => {
        const { TeamUsers } = session;

        teamFirst = session.Team.first()!;
        userFirst = session.User.first()!;
        userLast = session.User.last()!;

        expect(
          teamFirst.users?.toRefArray()
            .map(row => row.id)
        ).toEqual([
          userFirst.id,
          userLast.id,
        ]);
        expect(
          userFirst.teams!
            .toRefArray()
            .map(row => row.id)
        ).toEqual([teamFirst.id]);
        expect(
          userLast.teams!
            .toRefArray()
            .map(row => row.id)
        ).toEqual([teamFirst.id]);

        expect(TeamUsers.count()).toBe(2);
      };
    });

    it("add forward many-many field", () => {
      teamFirst.users?.add(
        userFirst,
        userLast
      );
      validateRelationState();
    });

    it("update forward many-many field", () => {
      teamFirst.update({ users: [userFirst, userLast] });
      validateRelationState();
    });

    it("add backward many-many field", () => {
      userFirst.teams!.add(teamFirst);
      userLast.teams!.add(teamFirst);
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
        users: [session.User.first()!, session.User.last()!],
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

      session.User.create({ name: "user0", teams: [session.Team.first()!] });
      session.User.create({ name: "user1" });
      session.User.create({ name: "user2", teams: [session.Team.first()!] });

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
    let validateRelationState: <Schema extends { User: typeof AnyModel; Team: typeof AnyModel; User2Team: typeof AnyModel }>(session: SessionWithBoundModels<Schema>) => void;

    beforeEach(() => {
      validateRelationState = <Schema extends { User: typeof AnyModel; Team: typeof AnyModel; User2Team: typeof AnyModel }>(session: SessionWithBoundModels<Schema>) => {
        const { User, Team, User2Team } = session;

        // Forward (from many-to-many field declaration)
        const user = User.get({ name: "user0" }) as unknown as { id: ModelId; teams: QuerySet<typeof Team> };
        const relatedTeams = user.teams;
        expect(relatedTeams).toBeInstanceOf(QuerySet);
        expect(relatedTeams.modelClass).toBe(Team);
        expect(relatedTeams.count()).toBe(1);

        // Backward
        const team = Team.get({ name: "team0" }) as unknown as { id: ModelId; users: QuerySet<typeof User> };
        const relatedUsers = team.users;
        expect(relatedUsers).toBeInstanceOf(QuerySet);
        expect(relatedUsers.modelClass).toBe(User);
        expect(relatedUsers.count()).toBe(2);

        expect(
          relatedUsers.toRefArray().map(row => row.id)
        ).toEqual(["u0", "u1"]);
        expect(
          castTo<{ users: QuerySet<typeof User> }>(Team.withId("t2"))
            .users.toRefArray()
            .map(row => row.id)
        ).toEqual(["u1"]);

        expect(
          relatedTeams.toRefArray().map(row => row.id)
        ).toEqual([team.id]);
        expect(
          castTo<{ teams: QuerySet<typeof Team> }>(User.withId("u1"))
            .teams.toRefArray()
            .map(row => row.id)
        ).toEqual(["t0", "t2"]);

        expect(User2Team.count()).toBe(3);
      };
    });
    it("without throughFields", () => {
      type UserDescriptors = {
        id: ModelId;
        name: string;
        teams: SourceRelationship<typeof Team, Relations.ForeignKey>;
      }
      class User extends Model<typeof User, UserDescriptors> implements UserDescriptors {
        static modelName = "User" as const;

        @Attribute()
        public id: ModelId;
      
        @Attribute()
        public name: string;

        public teams: SourceRelationship<typeof Team, Relations.ForeignKey>;
      }

      type User2TeamDescriptors = {
        id: ModelId;
        user: TargetRelationship<User, Relations.ForeignKey>;
        team: TargetRelationship<Team, Relations.ForeignKey>;
      }
      class User2Model extends Model<typeof User2Model, User2TeamDescriptors> implements User2TeamDescriptors {
        static modelName = "User2Team" as const;

        @Attribute()
        public id: ModelId;
      
        @ForeignKey<User2Model>("User")
        public user: TargetRelationship<User, Relations.ForeignKey>;

        @ForeignKey<User2Model>("Team")
        public team: TargetRelationship<Team, Relations.ForeignKey>;
      }

      type TeamDescriptors = {
        id: ModelId;
        name: string;
        users?: TargetRelationship<User, Relations.ManyToMany>;
        teams?: SourceRelationship<typeof Team, Relations.ForeignKey>;
      }
      class Team extends Model<typeof Team, TeamDescriptors> implements TeamDescriptors {
        static modelName = "Team" as const;

        @Attribute()
        public id: ModelId;

        @Attribute()
        public name: string;

        @ManyToMany<Team>({
          to: "User",
          through: "User2Team",
          relatedName: "teams",
        } as any)
        public users?: TargetRelationship<User, Relations.ManyToMany>;

        public teams?: SourceRelationship<typeof Team, Relations.ForeignKey>;
      }

      type Schema = ValidateSchema<{
        User: typeof User;
        User2Team: typeof User2Model;
        Team: typeof Team;
      }>;

      const orm = new ORM<Schema>();
      orm.register(User, Team, User2Model);
      const session = orm.session(orm.getEmptyState());

      session.Team.create({ id: "t0", name: "team0" });
      session.Team.create({ id: "t1", name: "team1" });
      session.Team.create({ id: "t2", name: "team2" });

      session.User.create({ id: "u0", name: "user0", teams: ["t0"] });
      session.User.create({ id: "u1", name: "user1", teams: ["t0", "t2"] });

      validateRelationState(session);
    });

    it("with throughFields", () => {
      type UserDescriptors = {
        id: ModelId;
        name: string;
        teams: SourceRelationship<typeof User2Team, Relations.ManyToMany>;
      }
      class User extends Model<typeof User, UserDescriptors> implements UserDescriptors {
        static modelName = "User" as const;

        @Attribute()
        public id: ModelId;

        @Attribute()
        public name: string;

        public teams: SourceRelationship<typeof User2Team, Relations.ManyToMany>;
      }

      type User2TeamDescriptors = {
        id: ModelId;
        user: TargetRelationship<User, Relations.ForeignKey>;
        team: TargetRelationship<Team, Relations.ForeignKey>;
      }
      class User2Team extends Model<typeof User2Team, User2TeamDescriptors> implements User2TeamDescriptors {
        static modelName = "User2Team" as const;

        @Attribute()
        public id: ModelId;
      
        @ForeignKey<User2Team>("User")
        public user: TargetRelationship<User, Relations.ForeignKey>;

        @ForeignKey<User2Team>("Team")
        public team: TargetRelationship<Team, Relations.ForeignKey>;
      }

      type TeamModelDescriptors = {
        id: ModelId;
        name: string;
        users?: TargetRelationship<User, Relations.ManyToMany>;
      }

      class Team extends Model<typeof Team, TeamModelDescriptors> implements TeamModelDescriptors {
        static modelName = "Team" as const;

        @Attribute()
        public id: ModelId;

        @Attribute()
        public name: string;
      
        @ManyToMany<Team>({
          to: 'User',
          through: 'User2Team',
          relatedName: 'teams',
          throughFields: ['user', 'team'],
      } as any)
        public users?: TargetRelationship<User, Relations.ManyToMany>;
      }

      type Schema = ValidateSchema<{
        Team: typeof Team;
        User: typeof User;
        User2Team: typeof User2Team;
      }>;

      const orm = new ORM<Schema>();
      orm.register(User, Team, User2Team);
      const session = orm.session(orm.getEmptyState());

      session.Team.create({ id: "t0", name: "team0" });
      session.Team.create({ id: "t1", name: "team1" });
      session.Team.create({ id: "t2", name: "team2" });

      session.User.create({ id: "u0", name: "user0", teams: ["t0"] });
      session.User.create({ id: "u1", name: "user1", teams: ["t0", "t2"] });

      validateRelationState(session);
    });

    it("with additional attributes", () => {
      type UserDescriptors = {
        id: ModelId;
        name: string;
        links?: SourceRelationship<typeof User2Team, Relations.ForeignKey>;
        teams?: SourceRelationship<typeof Team, Relations.ManyToMany>;
      }
      class User extends Model<typeof User, UserDescriptors> implements UserDescriptors {
        static modelName = "User" as const;

        @Attribute()
        public id: ModelId;

        @Attribute()
        public name: string;

        public links?: SourceRelationship<typeof User2Team, Relations.ForeignKey>;
        public teams?: SourceRelationship<typeof Team, Relations.ManyToMany>;
      }

      type User2TeamDescriptors = {
        id?: ModelId;
        name: string;
        user?: TargetRelationship<User, Relations.ForeignKey>;
        team?: TargetRelationship<Team, Relations.ForeignKey>;
      }
      class User2Team extends Model<typeof User2Team, User2TeamDescriptors> implements User2TeamDescriptors {
        static modelName = "User2Team" as const;

        @Attribute()
        public id?: ModelId;

        @Attribute()
        public name: string;;

        @ForeignKey<User2Team>("User", "links")
        public user?: TargetRelationship<User, Relations.ForeignKey>;

        @ForeignKey<User2Team>("Team", "links")
        public team?: TargetRelationship<Team, Relations.ForeignKey>;
      }

      type TeamDescriptors = {
        id: ModelId;
        name: string;
        users?: TargetRelationship<User, Relations.ManyToMany>;
        links?: SourceRelationship<typeof User2Team, Relations.ForeignKey>;
      }
      class Team extends Model<typeof Team, TeamDescriptors> implements TeamDescriptors {
        static modelName = "Team" as const;

        @Attribute()
        public id: ModelId;

        @Attribute()
        public name: string;

        @ManyToMany<Team>({
          to: "User",
          through: "User2Team",
          relatedName: "teams",
        } as any)
        public users?: TargetRelationship<User, Relations.ManyToMany>;

        public links?: SourceRelationship<typeof User2Team, Relations.ForeignKey>;
      }

      type Schema = ValidateSchema<{
        Team: typeof Team;
        User2Team: typeof User2Team;
        User: typeof User;
      }>;

      const orm = new ORM<Schema>();
      orm.register(User, Team, User2Team);
      const session = orm.session(orm.getEmptyState());

      session.Team.create({ id: "t0", name: "team0" });
      session.Team.create({ id: "t1", name: "team1" });
      session.Team.create({ id: "t2", name: "team2" });

      session.User.create({ id: "u0", name: "user0" });
      session.User.create({ id: "u1", name: "user1" });

      session.User2Team.create({ user: "u0", team: "t0", name: "link0" });
      session.User2Team.create({ user: "u1", team: "t0", name: "link1" });
      session.User2Team.create({ user: "u1", team: "t2", name: "link2" });

      validateRelationState(session);

      expect(
        session.User.withId("u0")!.links?.toRefArray()
          .map(row => row.name)
      ).toEqual(["link0"]);
      expect(
        session.User.withId("u1")!.links?.toRefArray()
          .map(row => row.name)
      ).toEqual(["link1", "link2"]);
    });

    it("throws if self-referencing relationship without throughFields", () => {
      type UserModelDescriptors = {
        id: ModelId;
        name: string;
        users: TargetRelationship<UserModel, Relations.ManyToMany>;
      }
      class UserModel extends Model<typeof UserModel, UserModelDescriptors> implements UserModelDescriptors {
        static modelName = "User" as const;

        @Attribute()
        public id: ModelId;

        @Attribute()
        public name: string;

        @ManyToMany<UserModel>({
          to: "User",
          through: "User2User",
          relatedName: "otherUsers",
        } as any) 
        public users: TargetRelationship<UserModel, Relations.ManyToMany>;
      }

      type User2UserModelDescriptors = {
        id: ModelId;
        name: string;
      }
      class User2UserModel extends Model<typeof User2UserModel, User2UserModelDescriptors> {
        static modelName = "User2User" as const;

        @Attribute()
        public id: ModelId;

        @Attribute()
        public name: string;
      }

      type Schema = ValidateSchema<{
        User: typeof UserModel;
        User2User: typeof User2UserModel;
      }>

      const orm = new ORM<Schema>();
      expect(() => {
        orm.register(UserModel, User2UserModel);
      }).toThrow(
        'Self-referencing many-to-many relationship at "User.users" using custom model "User2User" has no throughFields key. Cannot determine which fields reference the instances partaking in the relationship.'
      );
    });
  });

  describe('self-referencing many field with "this" as toModelName', () => {
    let session: ExtendedSession;

    beforeEach(() => {
      ({ session } = createTestSessionWithData());
    });

    it('adds relationships correctly when toModelName is "this"', () => {
      const { Tag, TagSubTags } = session;

      expect(TagSubTags.count()).toBe(0);

      Tag.withId("Technology")!.subTags!.add("Redux");
      expect(TagSubTags.all().toRefArray()).toEqual([
        {
          id: 0,
          fromTagId: "Technology",
          toTagId: "Redux",
        },
      ]);
      expect(Tag.withId("Technology")!.subTags!.count()).toBe(1);
      expect(Tag.withId("Technology")!.subTags!.toRefArray()).toEqual<Ref<InstanceType<Schema['Tag']>>[]>([Tag.withId("Redux")!.ref]);

      expect(Tag.withId("Redux")!.subTags!.count()).toBe(0);
      expect(Tag.withId("Redux")!.subTags!.toRefArray() ).toEqual([]);
    });

    it('removes relationships correctly when toModelName is "this"', () => {
      const { Tag, TagSubTags } = session;
      Tag.withId("Technology")!.subTags!.add("Redux");
      Tag.withId("Redux")!.subTags!.add("Technology");

      Tag.withId("Redux")!.subTags!.remove("Technology");

      expect(
        Tag.withId("Technology")!.subTags!.toRefArray()
      ).toEqual<Ref<InstanceType<Schema['Tag']>>[]>([Tag.withId("Redux")!.ref]);
      expect(TagSubTags.all().toRefArray()).toEqual([
        {
          id: 0,
          fromTagId: "Technology",
          toTagId: "Redux",
        },
      ]);
      expect(Tag.withId("Technology")!.subTags!.count()).toBe(
        1
      );
      expect(
        Tag.withId("Redux")!.subTags!.toRefArray()
      ).toEqual([]);
      expect(Tag.withId("Redux")!.subTags!.count()).toBe(0);
    });

    it('querying backwards relationships works when toModelName is "this"', () => {
      const { Tag } = session;
      Tag.withId("Technology")!.subTags!.add("Redux");

      expect(
        Tag.withId("Redux")!.parentTags!.toRefArray()
      ).toEqual<Ref<InstanceType<Schema['Tag']>>[]>([Tag.withId("Technology")!.ref]);
      expect(Tag.withId("Redux")!.parentTags!.count()).toBe(1);
      expect(
        Tag.withId("Technology")!.parentTags!.toRefArray()
      ).toEqual([]);
      expect(
        Tag.withId("Technology")!.parentTags!.count()
      ).toBe(0);
    });

    it('adding relationships via backwards descriptor works when toModelName is "this"', () => {
      const { Tag } = session;
      Tag.withId("Redux")!.parentTags!.add("Technology");

      expect(
        Tag.withId("Redux")!.parentTags!.toRefArray()
      ).toEqual<Ref<InstanceType<Schema['Tag']>>[]>([Tag.withId("Technology")!.ref]);
      expect(Tag.withId("Redux")!.parentTags!.count()).toBe(1);
      expect(
        Tag.withId("Technology")!.subTags!.toRefArray()
      ).toEqual<Ref<InstanceType<Schema['Tag']>>[]>([Tag.withId("Redux")!.ref]);
      expect(Tag.withId("Technology")!.subTags!.count()).toBe(
        1
      );
    });

    it('removing relationships via backwards descriptor works when toModelName is "this"', () => {
      const { Tag, TagSubTags } = session;
      Tag.withId("Technology")!.subTags!.add("Redux");
      Tag.withId("Redux")!.subTags!.add("Technology");

      Tag.withId("Technology")!.parentTags!.remove("Redux");

      expect(
        Tag.withId("Technology")!.subTags!.toRefArray()
      ).toEqual<Ref<InstanceType<Schema['Tag']>>[]>([Tag.withId("Redux")!.ref]);
      expect(TagSubTags.all().toRefArray()).toEqual([
        {
          id: 0,
          fromTagId: "Technology",
          toTagId: "Redux",
        },
      ]);
      expect(Tag.withId("Technology")!.subTags!.count()).toBe(
        1
      );
      expect(
        Tag.withId("Redux")!.subTags!.toRefArray()
      ).toEqual([]);
      expect(Tag.withId("Redux")!.subTags!.count()).toBe(0);
    });
  });

  describe("self-referencing many field with modelName as toModelName", () => {
    const createTestModels = () => {
      type UserDescriptors = {
        id: ModelId;
        subscribed?: SourceRelationship<typeof User, Relations.ManyToMany>;
        subscribers?: SourceRelationship<typeof User, Relations.ManyToMany>;
      };
  
      class User extends Model<typeof User, UserDescriptors> implements UserDescriptors {
        static modelName = "User" as const;
  
        @Attribute()
        public id: ModelId;
  
        //@ts-ignore
        @ManyToMany<User>("User", "subscribers")
        public subscribed?: SourceRelationship<typeof User, Relations.ManyToMany>;
  
        public subscribers?: SourceRelationship<typeof User, Relations.ManyToMany>;
      }

      return { User };
    }

    type Schema = {
      User: ReturnType<typeof createTestModels>['User'];
      UserSubscribed: ReturnType<typeof createTestModels>['User'];
    };

    let orm: ORM<Schema>;
    let session: SessionWithBoundModels<Schema>;
    let user0: SessionBoundModel<InstanceType<Schema['User']>>;
    let user1: SessionBoundModel<InstanceType<Schema['User']>>;
    let user2: SessionBoundModel<InstanceType<Schema['User']>>;
    let validateRelationState: () => void;

    beforeEach(() => {
      const { User } = createTestModels();
      orm = new ORM<Schema>();
      orm.register(User);
      session = orm.session();

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
          user0.subscribed!.toRefArray()
            .map(row => row.id)
        ).toEqual(["u2"]);
        expect(
          user1.subscribed!.toRefArray()
            .map(row => row.id)
        ).toEqual(["u0", "u2"]);
        expect(
          user2.subscribed!.toRefArray()
            .map(row => row.id)
        ).toEqual(["u1"]);

        expect(UserSubscribed.count()).toBe(4);
      };
    });

    it("add forward many-many field", () => {
      user0.subscribed!.add(user2);
      user1.subscribed!.add(user0, user2);
      user2.subscribed!.add(user1);
      validateRelationState();
    });

    it("update forward many-many field", () => {
      user0.update({ subscribed: [user2] });
      user1.update({ subscribed: [user0, user2] });
      user2.update({ subscribed: [user1] });
      validateRelationState();
    });

    it("add backward many-many field", () => {
      user0.subscribers!.add(user1);
      user1.subscribers!.add(user2);
      user2.subscribers!.add(user0, user1);
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
