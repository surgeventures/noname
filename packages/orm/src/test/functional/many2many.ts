import { Model, QuerySet, ORM, attr, many, fk } from "../..";
import { castTo } from "../../hacks";
import { AnyModel, ModelClassMap } from "../../Model";
import { ModelId, Relations, SessionLike, TargetRelationship, SessionBoundModel, Ref } from "../../types";
import {
  createTestSessionWithData,
  ExtendedSession,
  Schema,
} from "../helpers";

type UserDescriptors = {
  id?: ModelId;
  name?: string;
  //@ts-ignore
  subscribed?: TargetRelationship<User, Relations.ManyToMany>;
  subscribers?: unknown;
  teams?: unknown;
};

class User extends Model<typeof User, UserDescriptors> {
  static modelName = "User" as const;
  static fields = {
    id: attr(),
    name: attr(),
    subscribed: many("User", "subscribers"),
  };
}

type TeamDescriptors = {
  id?: ModelId;
  name?: string;
  users?: TargetRelationship<User, Relations.ManyToMany>;
};

class Team extends Model<typeof Team, TeamDescriptors> {
  static modelName = "Team" as const;
  static fields = {
    id: attr(),
    name: attr(),
    users: many("User", "teams"),
  };
}

describe("Many to many relationships", () => {
  describe("many-many forward/backward updates", () => {
    type Schema = {
      User: typeof User;
      Team: typeof Team;
      TeamUsers: typeof User;
      User2Team: typeof AnyModel;
    }
    
    type CustomSession = SessionLike<Schema>;
    let session: CustomSession;
    let teamFirst: SessionBoundModel<Team>;
    let userFirst: SessionBoundModel<User>;
    let userLast: SessionBoundModel<User>;
    let orm: ORM<Schema>;
    let validateRelationState: () => void;

    beforeEach(() => {
      const MyUser = class extends User {};
      const MyTeam = class extends Team {};

      orm = new ORM<Schema>();
      orm.register(MyUser, MyTeam);
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
          teamFirst.users.toRefArray()
            .map(row => row.id)
        ).toEqual([
          userFirst.id,
          userLast.id,
        ]);
        expect(
          userFirst
            .teams.toRefArray()
            .map(row => row.id)
        ).toEqual([teamFirst.id]);
        expect(
          userLast
            .teams.toRefArray()
            .map(row => row.id)
        ).toEqual([teamFirst.id]);

        expect(TeamUsers.count()).toBe(2);
      };
    });

    it("add forward many-many field", () => {
      teamFirst.users.add(
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
      userFirst.teams.add(teamFirst);
      userLast.teams.add(teamFirst);
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
    let validateRelationState: <Schema extends ModelClassMap>(session: SessionLike<Schema>) => void;

    beforeEach(() => {
      validateRelationState = <Schema extends ModelClassMap>(session: SessionLike<Schema>) => {
        const { User, Team, User2Team } = session;

        // Forward (from many-to-many field declaration)
        const user = User.get({ name: "user0" });
        const relatedTeams = user!.teams as QuerySet<Team>;
        expect(relatedTeams).toBeInstanceOf(QuerySet);
        expect(relatedTeams.modelClass).toBe(Team);
        expect(relatedTeams.count()).toBe(1);

        // Backward
        const team = Team.get({ name: "team0" })!;
        const relatedUsers = team.users;
        expect(relatedUsers).toBeInstanceOf(QuerySet);
        expect(relatedUsers.modelClass).toBe(User);
        expect(relatedUsers.count()).toBe(2);

        expect(
          relatedUsers.toRefArray().map(row => row.id)
        ).toEqual(["u0", "u1"]);
        expect(
          Team.withId("t2")!
            .users.toRefArray()
            .map(row => row.id)
        ).toEqual(["u1"]);

        expect(
          relatedTeams.toRefArray().map(row => row.id)
        ).toEqual([team.id]);
        expect(
          User.withId("u1")!
            .teams.toRefArray()
            .map(row => row.id)
        ).toEqual(["t0", "t2"]);

        expect(User2Team.count()).toBe(3);
      };
    });

    it("without throughFields", () => {
      type UserModelDescriptors = {
        id: ModelId;
        name: string;
        teams: unknown;
      }
      class UserModel extends Model<typeof UserModel, UserModelDescriptors> {
        static modelName = "User" as const;
        static fields = {
          id: attr(),
          name: attr(),
        };
      }

      type User2TeamModelDescriptors = {
        id: ModelId;
        user: TargetRelationship<User, Relations.ForeignKey>;
        team: TargetRelationship<Team, Relations.ForeignKey>;
      }
      class User2TeamModel extends Model<typeof User2TeamModel, User2TeamModelDescriptors> {
        static modelName = "User2Team" as const;
        static fields = {
          id: attr(),
          user: fk("User"),
          team: fk("Team"),
        };
      }

      type TeamModelDescriptors = {
        id: ModelId;
        name: string;
        users: TargetRelationship<User, Relations.ManyToMany>;
      }
      class TeamModel extends Model<typeof TeamModel, TeamModelDescriptors> {
        static modelName = "Team" as const;
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

      type Schema = {
        UserModel: typeof UserModel;
        User2TeamModel: typeof User2TeamModel;
        TeamModel: typeof TeamModel;
        User: typeof User;
        Team: typeof Team;
      }

      const orm = new ORM<Schema>();
      orm.register(User, Team, UserModel, TeamModel, User2TeamModel);
      const session = orm.session(orm.getEmptyState());

      session.Team.create({ id: "t0", name: "team0" });
      session.Team.create({ id: "t1", name: "team1" });
      session.Team.create({ id: "t2", name: "team2" });

      session.User.create({ id: "u0", name: "user0", teams: ["t0"] });
      session.User.create({ id: "u1", name: "user1", teams: ["t0", "t2"] });

      validateRelationState(session);
    });

    it("with throughFields", () => {
      type UserModelDescriptors = {
        id: ModelId;
        name: string;
      }
      class UserModel extends Model<typeof UserModel, UserModelDescriptors> {
        static modelName = "User" as const;
        static fields = {
          id: attr(),
          name: attr(),
        };
      }

      type User2TeamModelDescriptors = {
        id: ModelId;
        user: TargetRelationship<User, Relations.ForeignKey>;
        team: TargetRelationship<Team, Relations.ForeignKey>;
      }
      class User2TeamModel extends Model<typeof User2TeamModel, User2TeamModelDescriptors> {
        static modelName = "User2Team" as const;
        static fields = {
          id: attr(),
          user: fk("User"),
          team: fk("Team"),
        };
      }

      type TeamModelDescriptors = {
        id: ModelId;
        name: string;
        users: TargetRelationship<User, Relations.ManyToMany>;
      }

      class TeamModel extends Model<typeof TeamModel, TeamModelDescriptors> {
        static modelName = "Team" as const;
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

      type Schema = {
        User: typeof User;
        Team: typeof Team;
        UserModel: typeof UserModel;
        User2TeamModel: typeof User2TeamModel;
      }

      const orm = new ORM<Schema>();
      orm.register(User, Team, UserModel, TeamModel, User2TeamModel);
      const session = orm.session(orm.getEmptyState());

      session.Team.create({ id: "t0", name: "team0" });
      session.Team.create({ id: "t1", name: "team1" });
      session.Team.create({ id: "t2", name: "team2" });

      session.User.create({ id: "u0", name: "user0", teams: ["t0"] });
      session.User.create({ id: "u1", name: "user1", teams: ["t0", "t2"] });

      validateRelationState(session);
    });

    it("with additional attributes", () => {
      type UserModelDescriptors = {
        id: ModelId;
        name: string;
        links?: unknown;
        teams?: unknown;
      }
      class UserModel extends Model<typeof UserModel, UserModelDescriptors> {
        static modelName = "UserModel" as const;
        static fields = {
          id: attr(),
          name: attr(),
        };
      }

      type User2TeamModelDescriptors = {
        id?: ModelId;
        name: string;
        user?: TargetRelationship<User, Relations.ForeignKey>;
        team?: TargetRelationship<Team, Relations.ForeignKey>;
      }
      class User2TeamModel extends Model<typeof User2TeamModel, User2TeamModelDescriptors> {
        static modelName = "User2TeamModel" as const;
        static fields = {
          id: attr(),
          user: fk("UserModel", "links"),
          team: fk("TeamModel", "links"),
          name: attr(),
        };
      }

      type TeamModelDescriptors = {
        id: ModelId;
        name: string;
        users?: TargetRelationship<User, Relations.ManyToMany>;
        links?: unknown;
      }
      class TeamModel extends Model<typeof TeamModel, TeamModelDescriptors> {
        static modelName = "TeamModel" as const;
        static fields = {
          id: attr(),
          name: attr(),
          users: many({
            to: "UserModel",
            through: "User2TeamModel",
            relatedName: "teams",
          }),
        };
      }

      type Schema = {
        TeamModel: typeof TeamModel;
        User2TeamModel: typeof User2TeamModel;
        UserModel: typeof UserModel;
      }

      const orm = new ORM<Schema>();
      orm.register(UserModel, TeamModel, User2TeamModel);
      const session = orm.session(orm.getEmptyState());

      session.TeamModel.create({ id: "t0", name: "team0" });
      session.TeamModel.create({ id: "t1", name: "team1" });
      session.TeamModel.create({ id: "t2", name: "team2" });

      session.UserModel.create({ id: "u0", name: "user0" });
      session.UserModel.create({ id: "u1", name: "user1" });

      session.User2TeamModel.create({ user: "u0", team: "t0", name: "link0" });
      session.User2TeamModel.create({ user: "u1", team: "t0", name: "link1" });
      session.User2TeamModel.create({ user: "u1", team: "t2", name: "link2" });

      validateRelationState(session);

      expect(
        castTo<QuerySet<User2TeamModel>>(UserModel.withId("u0")!
          .links).toRefArray()
          .map(row => row.name)
      ).toEqual(["link0"]);
      expect(
        castTo<QuerySet<User2TeamModel>>(UserModel.withId("u1")!
          .links).toRefArray()
          .map(row => row.name)
      ).toEqual(["link1", "link2"]);
    });

    it("throws if self-referencing relationship without throughFields", () => {
      type UserModelDescriptors = {
        id: ModelId;
        name: string;
      }
      class UserModel extends Model<typeof UserModel, UserModelDescriptors> {
        static modelName = "UserModel" as const;
        static fields = {
          id: attr(),
          name: attr(),
          users: many({
            to: "UserModel",
            through: "User2UserModel",
            relatedName: "otherUsers",
          }),
        };
      }

      type User2UserModelDescriptors = {
        id: ModelId;
        name: string;
      }
      class User2UserModel extends Model<typeof User2UserModel, User2UserModelDescriptors> {
        static modelName = "User2UserModel" as const;
        static fields = {
          id: attr(),
          name: attr(),
        };
      }
      
      type Schema = {
        UserModel: typeof UserModel;
        User2UserModel: typeof User2UserModel;
      }

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

      const technologySubTags = castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Technology")!.subTags);
      
      technologySubTags.add("Redux");
      expect(TagSubTags.all().toRefArray()).toEqual([
        {
          id: 0,
          fromTagId: "Technology",
          toTagId: "Redux",
        },
      ]);
      expect(technologySubTags.count()).toBe(1);
      expect(technologySubTags.toRefArray()).toEqual<Ref<InstanceType<Schema['Tag']>>[]>([Tag.withId("Redux")!.ref]);

      const reduxSubTags = castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Redux")!.subTags);

      expect(reduxSubTags.count()).toBe(0);
      expect(reduxSubTags.toRefArray() ).toEqual([]);
    });

    it('removes relationships correctly when toModelName is "this"', () => {
      const { Tag, TagSubTags } = session;
      castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Technology")!.subTags).add("Redux");
      castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Redux")!.subTags).add("Technology");

      castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Redux")!.subTags).remove("Technology");

      expect(
        castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Technology")!.subTags).toRefArray()
      ).toEqual<Ref<InstanceType<Schema['Tag']>>[]>([Tag.withId("Redux")!.ref]);
      expect(TagSubTags.all().toRefArray()).toEqual([
        {
          id: 0,
          fromTagId: "Technology",
          toTagId: "Redux",
        },
      ]);
      expect(castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Technology")!.subTags).count()).toBe(
        1
      );
      expect(
        castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Redux")!.subTags).toRefArray()
      ).toEqual([]);
      expect(castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Redux")!.subTags).count()).toBe(0);
    });

    it('querying backwards relationships works when toModelName is "this"', () => {
      const { Tag } = session;
      castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Technology")!.subTags).add("Redux");

      expect(
        castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Redux")!.parentTags).toRefArray()
      ).toEqual<Ref<InstanceType<Schema['Tag']>>[]>([Tag.withId("Technology")!.ref]);
      expect(castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Redux")!.parentTags).count()).toBe(1);
      expect(
        castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Technology")!.parentTags).toRefArray()
      ).toEqual([]);
      expect(
        castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Technology")!.parentTags).count()
      ).toBe(0);
    });

    it('adding relationships via backwards descriptor works when toModelName is "this"', () => {
      const { Tag } = session;
      castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Redux")!.parentTags).add("Technology");

      expect(
        castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Redux")!.parentTags).toRefArray()
      ).toEqual<Ref<InstanceType<Schema['Tag']>>[]>([Tag.withId("Technology")!.ref]);
      expect(castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Redux")!.parentTags).count()).toBe(1);
      expect(
        castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Technology")!.subTags).toRefArray()
      ).toEqual<Ref<InstanceType<Schema['Tag']>>[]>([Tag.withId("Redux")!.ref]);
      expect(castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Technology")!.subTags).count()).toBe(
        1
      );
    });

    it('removing relationships via backwards descriptor works when toModelName is "this"', () => {
      const { Tag, TagSubTags } = session;
      castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Technology")!.subTags).add("Redux");
      castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Redux")!.subTags).add("Technology");

      castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Technology")!.parentTags).remove("Redux");

      expect(
        castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Technology")!.subTags).toRefArray()
      ).toEqual<Ref<InstanceType<Schema['Tag']>>[]>([Tag.withId("Redux")!.ref]);
      expect(TagSubTags.all().toRefArray()).toEqual([
        {
          id: 0,
          fromTagId: "Technology",
          toTagId: "Redux",
        },
      ]);
      expect(castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Technology")!.subTags).count()).toBe(
        1
      );
      expect(
        castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Redux")!.subTags).toRefArray()
      ).toEqual([]);
      expect(castTo<QuerySet<InstanceType<Schema['Tag']>>>(Tag.withId("Redux")!.subTags).count()).toBe(0);
    });
  });

  describe("self-referencing many field with modelName as toModelName", () => {
    type UserDescriptors = {
      id: ModelId;
      subscribed?: unknown;
      subscribers?: unknown;
    };

    class User extends Model<typeof User, UserDescriptors> {
      static modelName = "User" as const;
      static fields = {
        id: attr(),
        subscribed: many("User", "subscribers"),
      };
    }
    
    type Schema = {
      User: typeof User;
      UserSubscribed: typeof User;
    };

    let orm: ORM<Schema>;
    let session: SessionLike<Schema>;
    let user0: SessionBoundModel<User>;
    let user1: SessionBoundModel<User>;
    let user2: SessionBoundModel<User>;
    let validateRelationState: () => void;

    beforeEach(() => {
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
          castTo<QuerySet<User>>(user0
            .subscribed).toRefArray()
            .map(row => row.id)
        ).toEqual(["u2"]);
        expect(
          castTo<QuerySet<User>>(user1
            .subscribed).toRefArray()
            .map(row => row.id)
        ).toEqual(["u0", "u2"]);
        expect(
          castTo<QuerySet<User>>(user2
            .subscribed).toRefArray()
            .map(row => row.id)
        ).toEqual(["u1"]);

        expect(UserSubscribed.count()).toBe(4);
      };
    });

    it("add forward many-many field", () => {
      castTo<QuerySet<User>>(user0
        .subscribed).add(user2);
      castTo<QuerySet<User>>(user1
        .subscribed).add(user0, user2);
      castTo<QuerySet<User>>(user2
        .subscribed).add(user1);
      validateRelationState();
    });

    it("update forward many-many field", () => {
      user0.update({ subscribed: [user2] });
      user1.update({ subscribed: [user0, user2] });
      user2.update({ subscribed: [user1] });
      validateRelationState();
    });

    it("add backward many-many field", () => {
      castTo<QuerySet<User>>(user0
        .subscribers).add(user1);
      castTo<QuerySet<User>>(user1
        .subscribers).add(user2);
      castTo<QuerySet<User>>(user2
        .subscribers).add(user0, user1);
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
