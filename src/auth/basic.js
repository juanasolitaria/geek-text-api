const { verifyPassword } = require("../profiles/passwords");

function createBasicAuth(accounts, realm) {
  return async function authenticate(req, res, next) {
    res.set("Cache-Control", "no-store");
    const authorization = req.get("authorization") || "";
    const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization);
    function unauthorized() {
      res.set("WWW-Authenticate", 'Basic realm="' + realm + '", charset="UTF-8"');
      return res.status(401).json({ error: "Valid account credentials are required." });
    }

    if (!match || match[1].length > 1024) return unauthorized();
    const credentials = Buffer.from(match[1], "base64").toString("utf8");
    const colon = credentials.indexOf(":");
    if (colon < 0) return unauthorized();

    const username = credentials.slice(0, colon).trim().toLowerCase();
    const password = credentials.slice(colon + 1);
    const account = await accounts.findCredentials(username);
    if (!account || !(await verifyPassword(password, account.passwordHash))) return unauthorized();

    req.account = { id: account.id, username: account.username };
    next();
  };
}

module.exports = { createBasicAuth };
