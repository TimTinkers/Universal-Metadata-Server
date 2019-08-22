// Configure environment variables.
require('dotenv').config();

// Imports.
const express = require('express');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
const uuidv1 = require('uuid/v1');

// Configuring AWS account.
AWS.config.update({ region: 'us-east-2' });
let accessKey = process.env.AWS_ACCESS_KEY;
let secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
let credentials = new AWS.Credentials(accessKey, secretAccessKey);
AWS.config.credentials = credentials;
let docClient = new AWS.DynamoDB.DocumentClient();

// Middleware for enabling async routes with Express.
const asyncMiddleware = fn => (req, res, next) => {
	Promise.resolve(fn(req, res, next))
  .catch(next);
};

// Application setup.
const app = express();
app.use(express.static('static'));
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));

// Parsing out environment variables.
const APPLICATION = process.env.APPLICATION;
const PORT = process.env.PORT;

// Redirect visitors to the dashboard.
app.get('/', function (req, res) {
	res.render('dashboard');
});

app.post('/store', asyncMiddleware(async (req, res, next) => {
	let data = req.body;
	let id = uuidv1();
	console.log(id);
	data.id = id;
	data = JSON.stringify(data);
	console.log(data);
	try {
		let params = {
			TableName: 'Arbitrary-JSON-Storage',
			Item: {
				id: id.toString(),
				data: data
			}
		};
		docClient.put(params, function (error, data) {
			if (error) {
				console.log('Error', error);
			} else {
				console.log('Success', data);
			}
		});
		res.send({ 'id': id });
	}	catch (error) {
		console.error(error);
		res.sendStatus(500).send({ error });
	}
}));

app.post('/update', asyncMiddleware(async (req, res, next) => {
	try {
		let params = {
			TableName: 'Arbitrary-JSON-Storage',
			Item: {
				id: (req.body.id).toString(),
				data: JSON.stringify(req.body.data)
			}
		};
		docClient.put(params, function (error, data) {
			if (error) {
				console.log('Error', error);
			} else {
				console.log('Success');
				res.sendStatus(200);
			}
		});
	}	catch (error) {
		console.error(error);
		res.sendStatus(500).send({ error });
	}
}));

app.post('/delete', asyncMiddleware(async (req, res, next) => {
	try {
		let params = {
			TableName: 'Arbitrary-JSON-Storage',
			Key: {
				id: (req.body.id).toString()
			}
		};
		docClient.delete(params, function (error, data) {
			if (error) {
				console.log('Error', error);
			} else {
				console.log('Success');
				res.sendStatus(200);
			}
		});
	}	catch (error) {
		console.error(error);
		res.sendStatus(500).send({ error });
	}
}));

app.get('/retrieve/:id', asyncMiddleware(async (req, res, next) => {
	let id = req.params.id;
	console.log(id);
	try {
		let params = {
			TableName: 'Arbitrary-JSON-Storage',
			AttributesToGet: [
				'data'
			],
			Key: {
				id: id
			}
		};
		docClient.get(params, function (error, data) {
			if (error) {
				console.log('Error', error);
			} else {
				if (data.Item === undefined) {
					res.sendStatus(500).send({ error: 'Error: Invalid ID' });
				} else {
					console.log('Success', data);
					res.send(JSON.parse(data.Item.data));
				}
			}
		});
	}	catch (error) {
		console.error(error);
		res.sendStatus(500).send({ error: error });
	}
}));

// Launch the application and begin the server listening.
app.listen(PORT, function () {
	console.log(APPLICATION, 'listening on port', PORT);
});
