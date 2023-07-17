const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

let db = null;
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Started");
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};

initializeDbAndServer();

//Login API//
app.post("/login/", async (request, response) => {
  const loggerDetails = request.body;
  const { username, password } = loggerDetails;

  const userQuery = `SELECT * FROM user
 WHERE username = "${username}";`;
  const userDb = await db.get(userQuery);

  if (userDb === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const decryptPwd = await bcrypt.compare(password, userDb.password);
    if (decryptPwd === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "secret_key");
      response.send({ jwtToken });
    }
  }
});

const authenticateToken = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    await jwt.verify(jwtToken, "secret_key", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

///state Api//
app.get("/states/", authenticateToken, async (request, response) => {
  const stateQuery = `SELECT state_id as stateId,
    state_name as stateName, population as population FROM
    state;`;
  const stateDetails = await db.all(stateQuery);
  response.send(stateDetails);
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `SELECT state_id as stateId,
    state_name as stateName, population as population FROM
    state WHERE state_id = "${stateId}";`;
  const stateDetails = await db.get(stateQuery);
  response.send(stateDetails);
});

///district post api///
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;

  const addDistrictQuery = `INSERT INTO district
  (district_name, state_id, cases, cured, active, deaths)
  VALUES("${districtName}", ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;

  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

///api5 d_id///
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT district_id as districtId,
    district_name as districtName, state_id as stateId, cases, cured, active, deaths FROM district
    WHERE district_id = ${districtId};`;
    const districtData = await db.get(getDistrictQuery);
    response.send(districtData);
  }
);

///delete api//
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district
    WHERE district_id = ${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateQuery = `UPDATE district SET
  district_name = "${districtName}",
  state_id = ${stateId},
  cases = ${cases},
  cured = ${cured},
  active = ${active},
  deaths = ${deaths}
  WHERE district_id = ${districtId};`;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

///api 8//
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `SELECT sum(cases) as totalCases,
    sum(cured) as totalCured, sum(active) as totalActive,
    sum(deaths) as totalDeaths FROM district
    WHERE state_id = ${stateId};`;
    const statistics = await db.get(getStatsQuery);
    response.send(statistics);
  }
);

module.exports = app;
