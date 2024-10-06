const express = require('express');
const couchbase = require('couchbase');
const app = express();

app.use(express.json()); // For parsing JSON request bodies

// Couchbase connection (use your existing cluster and bucket connection)
const clusterConnStr = "couchbases://cb.od3oaug--eu36aeb.cloud.couchbase.com"; 
const username = "BASEMEMT";
const password = "There'sThe123";
const bucketName = "default";

let bucket, defaultCollection;

async function initCouchbase() {
    const cluster = await couchbase.connect(clusterConnStr, {
        username: username,
        password: password,
        configProfile: "wanDevelopment",
    });

    const pingResult = await cluster.ping();
    console.log("Cluster ping result:", pingResult);

    bucket = cluster.bucket(bucketName);
    defaultCollection = bucket.defaultCollection();
    console.log("Successfully connected to the bucket:", bucketName);
}

initCouchbase().catch(console.error);

// Middleware to check if the account is banned
async function checkBan(req, res, next) {
    const { username } = req.body;
    
    try {
        const user = await defaultCollection.get(username);
        
        if (user.content.banned) {
            return res.status(404).send("Account Banned");
        }

        next();
    } catch (error) {
        if (error instanceof couchbase.errors.DocumentNotFoundError) {
            next();
        } else {
            console.error(error);
            res.status(500).send("Internal Server Error");
        }
    }
}

// Login endpoint (Create a new user if doesn't exist, or login)
app.post('/login', checkBan, async (req, res) => {
    const { username, IsOnline, ServerURL } = req.body;

    try {
        const userDoc = await defaultCollection.get(username);
        const user = userDoc.content;

        if (user.password === password) {
            // Update user online status and server URL
            user.IsOnline = IsOnline;
            user.ServerURL = ServerURL;
            await defaultCollection.upsert(username, user);
            return res.send("Login successful!");
        } else {
            return res.status(401).send("Incorrect password!");
        }
    } catch (error) {
        if (error instanceof couchbase.errors.DocumentNotFoundError) {
            const newUser = {
                username: username,
                password: "default_password", // Set a default password or remove this line if you want to avoid it
                banned: false,
                IsOnline: IsOnline,
                ServerURL: ServerURL
            };
            await defaultCollection.upsert(username, newUser);
            return res.send("User created and logged in successfully!");
        } else {
            console.error(error);
            return res.status(500).send("Internal Server Error");
        }
    }
});

// Logout endpoint
app.post('/logout', async (req, res) => {
    const { username } = req.body;

    try {
        const userDoc = await defaultCollection.get(username);
        const user = userDoc.content;

        // Set IsOnline to false and clear ServerURL
        user.IsOnline = false;
        user.ServerURL = null; // or '' if you prefer to keep it as an empty string
        await defaultCollection.upsert(username, user);

        return res.send("Logout successful!");
    } catch (error) {
        if (error instanceof couchbase.errors.DocumentNotFoundError) {
            return res.status(404).send("User not found!");
        } else {
            console.error(error);
            return res.status(500).send("Internal Server Error");
        }
    }
});

// Ban user endpoint (Admin use to ban users)
app.post('/ban/:username', async (req, res) => {
    const { username } = req.params;

    try {
        const userDoc = await defaultCollection.get(username);
        const user = userDoc.content;

        user.banned = true;

        await defaultCollection.upsert(username, user);

        return res.send(`User ${username} has been banned.`);
    } catch (error) {
        if (error instanceof couchbase.errors.DocumentNotFoundError) {
            return res.status(404).send("User not found!");
        } else {
            console.error(error);
            return res.status(500).send("Internal Server Error");
        }
    }
});

// Example protected endpoint (to demonstrate ban check)
app.get('/protected', checkBan, (req, res) => {
    res.send("Welcome to the protected endpoint!");
});

// Start the Express server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
