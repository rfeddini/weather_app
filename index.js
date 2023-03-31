require("dotenv").config();
const axios = require("axios");
const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(path.join(__dirname + "/database.sqllite"));
const cookieParser = require("cookie-parser");
const { response } = require("express");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function sendMail(email) {
  const msg = {
    to: email, // Change to your recipient
    from: "riadh.feddini@gmail.com", // Change to your verified sender
    subject: "Sending with SendGrid is Fun",
    text: "and easy to do anywhere, even with Node.js",
    html: "<strong>and easy to do anywhere, even with Node.js</strong>",
  };
  sgMail
    .send(msg)
    .then(() => {
      console.log("Email sent");
    })
    .catch((error) => {
      console.error(error);
    });
}

function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      db.prepare("Select * from users where email = ? ").get(
        [email],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  });
}
function getUserByCookie(cookie) {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      db.prepare("Select * from users where auth_cookie = ?").get(
        [cookie],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  });
}

function updateUserCookie(cookie, id) {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      db.prepare("Update users set auth_cookie = ? where id = ?").run(
        [cookie, id],
        (err) => {
          if (err) reject(err);
          else resolve(true);
        }
      );
    });
  });
}

async function isUserAuthenticated(cookie) {
  try {
    const result = await getUserByCookie(cookie);
    console.log(!!result);
    return !!result;
  } catch (err) {
    return false;
  }
}

function makecookie(length) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}
function validateEmail(email) {
  var re = /\S+@\S+\.\S+/;
  return re.test(email);
}

apiKey = process.env.WEATHER_API_KEY;

db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, password TEXT NOT NULL, auth_cookie TEXT)"
  );
});

app.use(express.static("assets"));
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

app.use(cookieParser());


app.get("/", async function (req, res) {
  if (!(await isUserAuthenticated(req.cookies.auth))) {
    res.redirect("/signin");
    return;
  }
  res.sendFile(path.join(__dirname + "/assets/weather.html"));
});
app.post("/", async function (req, res) {
  if (!(await isUserAuthenticated(req.cookies.auth))) {
    res.redirect("/signin");
    return;
  }
  try {
    const response = await axios.get(
      `http://api.weatherapi.com/v1/current.json?q=${req.body.city}&key=${apiKey}`
    );
    const temperature = `
     <!DOCTYPE html>
<html lang="en" >
<head>
  <meta charset="UTF-8">
  <title>Simple Login Form Example</title>
  <link rel='stylesheet' href='https://fonts.googleapis.com/css?family=Rubik:400,700'>
  <link rel="stylesheet" href="./style.css">

</head>
<body>
<!-- partial:index.partial.html -->
<div class="login-form">
  <form action="/" method="POST">
    <h1>Weather ☀️</h1>
    <div class="content">
      <div class="input-field">
        <p> the temperatur in ${req.body.city} is : ${response.data.current.temp_c} </p>
      </div>
      
      
    
      
    </div>
    <div class="action">
      <input type="submit" value="Send" />
    </div>
  </form>
</div>
<!-- partial -->
  

</body>
</html>

     `;

    res.send(temperature);
  } catch (error) {
    res.status(404).send(error.message);
  }
});

app.get("/signin", async function (req, res) {
  // chack if user has cookie
  if (req.cookies.auth) {
    const cookie = req.cookies.auth;
    try {
      const user = await getUserByCookie(cookie);
      if (user) {
        res.redirect("/");
      }
    } catch (err) {
      res.end("Unexpected Error");
      return;
    }
  }

  res.sendFile(path.join(__dirname + "/assets/signin.html"));
});

app.post("/signin", async function (req, res) {
  const user = req.body;
  if (!validateEmail(user.email)) {
    res.send("<h1>This is not a valid email, Go back &#127939;</h1>");
    return;
  }
  //check if mail and password exist in database
  const dbuser = await getUserByEmail(user.email);
  if (!dbuser || (dbuser && dbuser.password != user.password)) {
    res.send(
      "<h1>This email or password doesn't exist, Go back &#127939;</h1>"
    );
    return;
  }
  // update auth_cookie
  const cookie = makecookie(16);
  try {
    await updateUserCookie(cookie, dbuser.id);
  } catch (error) {
    res.send(error.message);
    return;
  }

  res.redirect("/");
  return;
});

app.get("/signup", function (req, res) {
  res.sendFile(path.join(__dirname + "/assets/signup.html"));
});

app.post("/signup", async function (req, res) {
  const user = req.body;
  console.log(user);
  // check if password is same as confirmPassword
  if (user.password !== user.confirmPassword) {
    res.send("<h1>Password doesn't match, Go back &#127939;</h1>");
  }
  // check if the mail has the right format
  if (!validateEmail(user.email)) {
    res.send("<h1>This is not a valid email, Go back &#127939;</h1>");
  }
  // if query sql exist or not  res.send("This is already exist, Go Back ");
  try {
    const existingUser = await getUserByEmail(user.email);
    if (existingUser) {
      res.end("This email already exist,");
      return;
    }
  } catch (err) {
    res.end(err.message);
    return;
  }
  // save cookie
  const cookies = makecookie(16);
  res.cookie("auth", cookies);
  //insert users related objects in SQLLite database
  db.serialize(async () => {
    const result = await db
      .prepare(
        "INSERT INTO users(email, password, auth_cookie) Values (?, ?, ?)"
      )
      .run([user.email, user.password, cookies]);
  });

  sendMail(user.email);
  res.redirect("/");
});

app.listen(8080);
