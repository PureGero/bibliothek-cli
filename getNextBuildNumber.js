const {MongoClient} = require("mongodb");
const yargs = require("yargs");

const argv = yargs
  .option("projectName", optionOf("string"))
  .option("projectFriendlyName", optionOf("string"))
  .option("versionGroupName", optionOf("string"))
  .option("versionName", optionOf("string"))
  .option("buildChannel", optionOf("string", false))
  .default("buildChannel", "default")
  .help()
  .version(false)
  .argv;

const projectName = argv.projectName;
const projectFriendlyName = argv.projectFriendlyName;
const versionGroupName = argv.versionGroupName;
const versionName = argv.versionName;
// type:path:hash:name
const buildChannel = argv.buildChannel.toUpperCase();

// Validate buildChannel
if (buildChannel !== "DEFAULT" && buildChannel !== "EXPERIMENTAL") {
  console.log(`Invalid buildChannel: ${buildChannel}`);
  return;
}

// ----------------------------------------------------------------------------------------------------

const client = new MongoClient("mongodb://localhost:27017", {
  useUnifiedTopology: true
});

async function run() {
  try {
    await client.connect();
    const database = client.db("library"); // "library" instead of "bibliothek" is intentional here
    const project = await database.collection("projects").findOneAndUpdate(
      {"name": projectName},
      {
        $setOnInsert: {
          "name": projectName,
          "friendlyName": projectFriendlyName
        }
      },
      {
        new: true,
        returnDocument: "after",
        upsert: true
      }
    );
    const versionGroup = await database.collection("version_groups").findOneAndUpdate(
      {
        "project": project.value._id,
        "name": versionGroupName
      },
      {
        $setOnInsert: {
          "project": project.value._id,
          "name": versionGroupName
        }
      },
      {
        new: true,
        returnDocument: "after",
        upsert: true
      }
    );
    const version = await database.collection("versions").findOneAndUpdate(
      {
        "project": project.value._id,
        "name": versionName
      },
      {
        $setOnInsert: {
          "project": project.value._id,
          "group": versionGroup.value._id,
          "name": versionName
        }
      },
      {
        new: true,
        returnDocument: "after",
        upsert: true
      }
    );
    const oldBuild = await database.collection("builds").findOne({
      "project": project.value._id,
      "version": version.value._id
    }, {sort: {_id: -1}});

    const buildNumber = (oldBuild && oldBuild.number + 1) || 1;

    console.log(buildNumber);
  } finally {
    await client.close();
  }
}

run().catch(console.dir);

function optionOf(type, required = true) {
  return {
    type: type,
    required: required
  };
}
