const express = require('express');
const axios = require('axios');

const webApp = express();

webApp.get("/", (req, res) => {
	res.send("bot is running");
});

function Maintainer() {
	webApp.listen(8000, () => {
		console.log("web server ready");
	})
}

module.exports = Maintainer;