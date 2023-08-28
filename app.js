const express = require("express");
const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("The server is running on the port number 3000");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
    process.exit(1);
  }
};
initializeDbServer();

// authenticate Token

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "Mounika", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// get states api

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    select * from state;
    `;
  const getStates = await db.all(getStatesQuery);
  const ans = (eachItem) => {
    return {
      stateId: eachItem.state_id,
      stateName: eachItem.state_name,
      population: eachItem.population,
    };
  };
  response.send(getStates.map((eachItem) => ans(eachItem)));
});

// get state api

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    select * from state where state_id=${stateId};
    `;
  const getState = await db.get(getStateQuery);
  response.send({
    stateId: getState.state_id,
    stateName: getState.state_name,
    population: getState.population,
  });
});

// post district

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `
    insert into district (district_name,state_id,cases,cured,active,deaths)
    values
    ('${districtName}',${stateId},${cases},${cured},${active},${deaths});
    `;
  await db.run(postDistrictQuery);
  response.send("District Successfully Added");
});

// get district

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `
    select * from district where district_id=${districtId};
    `;
    const getDistrict = await db.get(districtQuery);
    response.send({
      districtId: getDistrict.district_id,
      districtName: getDistrict.district_name,
      stateId: getDistrict.state_id,
      cases: getDistrict.cases,
      cured: getDistrict.cured,
      active: getDistrict.active,
      deaths: getDistrict.deaths,
    });
  }
);

// delete district

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    delete from district where district_id=${districtId};
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// update district

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
    update district
    set district_name='${districtName}',state_id=${stateId},cases=${cases},
    cured=${cured},active=${active},deaths=${deaths}
    where district_id=${districtId};
    `;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// get state stats

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `
    select sum(cases) as totalCases,sum(cured) as totalCured,sum(active) as totalActive,sum(deaths) as totalDeaths from district where state_id=${stateId} group by state_id;
    `;
    const getStats = await db.get(getStatsQuery);
    response.send(getStats);
  }
);
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const isUserPresentQuery = `
    select * from user where username='${username}';
    `;
  const userPresent = await db.get(isUserPresentQuery);
  if (userPresent === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isValidPassword = await bcrypt.compare(
      password,
      userPresent.password
    );
    if (isValidPassword) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "Mounika");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

module.exports = app;
