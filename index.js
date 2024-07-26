const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const {
	Pool
} = require('pg');
dotenv.config();

const app = express();
const port = 3000;
const caCert  = fs.readFileSync(path.join(__dirname, 'certs/ca.pem')).toString();


const pool = new Pool({
	user: process.env.DB_USER,
	host: process.env.DB_HOST,
	database: process.env.DB_NAME,
	password: process.env.DB_PASSWORD,
	port: process.env.DB_PORT,
	ssl: {
	  ca: caCert, // Include the CA certificate
	  rejectUnauthorized: true // Ensure the certificate is valid (recommended for production)
	}
  });


app.use(cors());

app.use(bodyParser.urlencoded({
	extended: true
}));


// Middleware for parsing JSON bodies
app.use(express.json());


const generateToken = (userId) => {
	return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};


app.post('/register', async (req, res) => {


	const { username, password, firstName, lastName, email } = req.body;

	const hashpassword = await bcrypt.hash(password, 10);

	try {
		const client = await pool.connect();
		const result = await pool.query(
			'INSERT INTO users (username, password, first_name, last_name, email) VALUES ($1, $2, $3, $4, $5) RETURNING id',
			[username, hashpassword, firstName, lastName, email]
		);
		const user = result.rows[0];
		client.release();

		res.status(200).json({
			id: user.id,
			username: username,
			message: "User is registered"
		});
	} catch (err) {
		res.status(500).json({
			error: 'Internal server error'
		});

	}


});

app.post('/login', async (req, res) => {

	const {
		username,
		password
	} = req.body;

	try {

	
		const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
		const recordfound = result.rows.length;

		if (recordfound > 0) {

			const user = result.rows[0];




			const isPasswordMatch = await bcrypt.compare(password, user.password);

			if (isPasswordMatch) {
				const token = generateToken(user.id);
				res.status(200).json({
					userid: user.username,
					firstName: user.first_name,
					lastName: user.last_name,
					email: user.email,
					token: token,
					message: "Login Successful"
				});
			} else {
				res.status(200).json({
					userid: user.ussername,
					message: "Invalid Password"
				});
			}

		} else {


			res.status(200).json({
				message: "invalid User"
			});
		}

	} catch (error) {
		res.status(500).json({
			error: "Internal Error"
		});
	}

});





app.post('/teting', (req, res) => {

	res.json({ message: "sadfdsa" });

});







const autheiticate = (req, res, next) => {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];

	if (token == null) return res.sendStatus(401);

	jwt.verify(token, process.env.JWT_SECRET, (err, user) => {

		if (err) return res.sendStatus(403);
		req.user = user;
		next();

	});

};



// Create a new lead
app.post('/leads', autheiticate, async (req, res) => {
	const { firstName, lastName, email, source } = req.body;
	const createdUser = req.user.id; // Assuming the JWT token includes the user ID

	try {
		const result = await pool.query(
			'INSERT INTO leads (first_name, last_name, email, source, created_user) VALUES ($1, $2, $3, $4, $5) RETURNING id',
			[firstName, lastName, email, source, createdUser]
		);
		res.status(201).send(`Lead created with ID: ${result.rows[0].id}`);
	} catch (error) {
		res.status(400).send(error.message);
	}
});


app.listen(port, () => {

	console.log(`Server is running on port ${port}`);

});