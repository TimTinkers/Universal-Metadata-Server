// Configure environment variables.
require('dotenv').config();

// Imports.
const express = require('express');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const storageClient = jwksClient({
	jwksUri: 'https://arbitrary-json-storage.auth0.com/.well-known/jwks.json'
});

// Configuring AWS account.
AWS.config.update({ region: 'us-east-2' });
let accessKey = process.env.AWS_ACCESS_KEY;
let secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
let credentials = new AWS.Credentials(accessKey, secretAccessKey);
AWS.config.credentials = credentials;
let docClient = new AWS.DynamoDB.DocumentClient();

// Middleware for enabling async routes with Express.
const asyncMiddleware = fn => (req, res, next) => {
	Promise.resolve(fn(req, res, next)).catch(next);
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

app.get('/login', function (req, res) {
	res.render('loginDashboard');
});

function getKey (header, callback) {
	storageClient.getSigningKey(header.kid, function (error, key) {
		if (error) {
			console.error(error);
			return ({ error: error.stack });
		}
		let signingKey = key.publicKey || key.rsaPublicKey;
		callback(null, signingKey);
	});
};

app.post('/store', asyncMiddleware(async (req, res, next) => {
	let storageTokenBearer = req.headers.authorization;
	let storageToken = storageTokenBearer.split(' ').pop();
	if (storageToken === undefined || storageToken === 'undefined') {
		res.status(401).send({ error: 'Token is unauthorized.' });

	// Otherwise, verify the correctness of the access token.
	} else {
		jwt.verify(storageToken, getKey, function (error, decoded) {
			if (error) {
				res.status(401).send({ error: 'Token is unauthorized.' });
			} else {
				let data = req.body;
				let id = req.body.id;
				data.id = id;
				data = JSON.stringify(data);
				console.log(decoded);
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
					res.status(200).send({ 'id': id });
				}	catch (error) {
					console.error(error);
					res.status(500).send({ error: error });
				}
			}
		});
	}
}));

app.post('/update', asyncMiddleware(async (req, res, next) => {
	let storageTokenBearer = req.headers.authorization;
	let storageToken = storageTokenBearer.split(' ').pop();
	if (storageToken === undefined || storageToken === 'undefined') {
		res.status(401).send({ error: 'Token is unauthorized.' });

	// Otherwise, verify the correctness of the access token.
	} else {
		jwt.verify(storageToken, getKey, function (error, decoded) {
			if (error) {
				res.status(401).send({ error: 'Token is unauthorized.' });
			} else {
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
			}
		});
	}
}));

app.post('/delete', asyncMiddleware(async (req, res, next) => {
	let storageTokenBearer = req.headers.authorization;
	let storageToken = storageTokenBearer.split(' ').pop();
	if (storageToken === undefined || storageToken === 'undefined') {
		res.status(401).send({ error: 'Token is unauthorized.' });

	// Otherwise, verify the correctness of the access token.
	} else {
		jwt.verify(storageToken, getKey, function (error, decoded) {
			if (error) {
				res.status(401).send({ error: 'Token is unauthorized.' });
			} else {
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
			}
		});
	}
}));

let retrieve = async function (id) {
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
		let dynamoResponse = await docClient.get(params).promise();
		console.log(dynamoResponse);
		if (dynamoResponse.error) {
			return ({ error: dynamoResponse.rror });
		} else {
			if (dynamoResponse.Item === undefined) {
				return ({ error: 'Error: Invalid ID' });
			} else {
				console.log(JSON.parse(dynamoResponse.Item.data));
				return (JSON.parse(dynamoResponse.Item.data));
			}
		}
	}	catch (error) {
		console.error(error);
		return ({ error: error });
	}
};

app.get('/retrieve/:id', asyncMiddleware(async (req, res, next) => {
	let id = req.params.id;
	console.log(id);
	let response = await retrieve(id);
	console.log(response);
	if (response.error) {
		res.status(500).send(response);
	} else {
		res.status(200).send(response);
	}
}));

// Launch the application and begin the server listening.
app.listen(PORT, function () {
	console.log(APPLICATION, 'listening on port', PORT);
});
