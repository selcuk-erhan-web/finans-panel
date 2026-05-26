const express = require("express");
const path = require("path");

const registerDashboard = require("./routes/dashboard");
const { registerVehicles } = require("./routes/vehicles");
const registerTransactions = require("./routes/transactions");
const registerReports = require("./routes/reports");
const registerSettings = require("./routes/settings");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const username = "admin";
const password = "1234";

app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) {
    res.setHeader("WWW-Authenticate", "Basic");
    return res.status(401).send("Giriş gerekli");
  }
  const encoded = auth.split(" ")[1];
  const decoded = Buffer.from(encoded, "base64").toString();
  const [user, pass] = decoded.split(":");
  if (user === username && pass === password) return next();
  res.setHeader("WWW-Authenticate", "Basic");
  return res.status(401).send("Hatalı giriş");
});

registerDashboard(app);
registerVehicles(app);
registerTransactions(app);
registerReports(app);
registerSettings(app, port);

app.listen(port, () => {
  console.log(`Finans paneli: http://localhost:${port}`);
});
