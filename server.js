let express 		= require('express')
	, app 			= express()
	, mongoose 		= require('mongoose')
	, bodyParser 	= require('body-parser')
	, morgan 		= require('morgan')
	, ejs 			= require('ejs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('./public'));
app.use(morgan('dev'));
app.set('views', __dirname + '/src/views/');
app.set('view engine', 'ejs');

app.get('/');

app.listen(3000, err => {
	if(err)
		return console.log(err);

	console.log('Running...');
})