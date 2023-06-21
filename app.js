const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();
app.use(express.json());

let database = null;

const intializeDBServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("server start at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`error at :${e.message}`);
    process.exit(1);
  }
};

intializeDBServer();

//converter
const directorColumnconverter = (object) => {
  return {
    districtId: object.district_id,
    districtName: object.district_name,
    stateId: object.state_id,
    cases: object.cases,
    cured: object.cured,
    active: object.active,
    deaths: object.deaths,
  };
};

//converter
const stateColumnConverter = (object) => {
  return {
    stateId: object.state_id,
    stateName: object.state_name,
    population: object.population,
  };
};

//authentication middleware function
const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secret", async (error, payload) => {
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

//login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userIsThere = `
    select * from user
    where
    username='${username}';`;
  const uesrFound = await database.get(userIsThere);

  if (uesrFound === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const matchPassword = await bcrypt.compare(password, uesrFound.password);
    if (matchPassword === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "secret");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

/// GET States

app.get("/states/", authentication, async (request, response) => {
  const stateQuery = `
    SELECT 
        * 
    FROM 
        state 
    ORDER BY 
        state_id;
    `;
  const states = await database.all(stateQuery);
  response.send(states.map((each) => stateColumnConverter(each)));
});

/// GET stateId based on stateId

app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `
    select * from state
    where 
    state_id='${stateId}';`;
  const oneState = await database.get(stateQuery);
  response.send(stateColumnConverter(oneState));
});

/// POST district
app.post("/districts/", async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const districtQuery = `
    INSERT INTO 
        district(district_name,state_id,cases,cured,active,deaths)
    VALUES(
        '${districtName}',
        '${stateId}',
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}'
    );
    `;
  await database.run(districtQuery);
  response.send("District Successfully Added");
});

/// GET district based on districtId

app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `
    SELECT 
        * 
    FROM 
        district
    WHERE 
        district_id = '${districtId}';

    `;
    const district = await database.get(districtQuery);
    response.send(directorColumnconverter(district));
  }
);

//// API DELETE
app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
    SELECT 
        * 
    FROM 
        district 
    WHERE 
        district_id = '${districtId}';
    `;
    await database.run(deleteQuery);
    response.send("District Removed");
  }
);

//// API UPDATE

app.put(
  "/districts/:districtId/",
  authentication,
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
    const updateQuery = `
    UPDATE 
        district 
    SET 
        district_name = '${districtName}',
        state_id = '${stateId}',
        cases = '${cases}',
        cured = '${cured}',
        active = '${active}',
        deaths = '${deaths}'
    WHERE 
        district_id = '${districtId}'
    ;`;
    await database.run(updateQuery);
    response.send("District Details Updated");
  }
);

/// API get

app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const stateQuery = `
    SELECT 
        SUM(cases) as totalCases,
        SUM(cured) as totalCured,
        SUM(active) as totalActive,
        SUM(deaths) as totalDeaths
    FROM 
        district
    WHERE 
        state_id = '${stateId}';
    `;
    const updateStates = await database.get(stateQuery);
    response.send(updateStates);
  }
);
module.exports = app;
