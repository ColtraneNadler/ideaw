let ig = require('./instagram')
	, sc = require('./soundcloud')
	, api = require('./api');

let init = () => {
	process.stdin.resume();
	process.stdin.setEncoding('utf8');
	process.stdin.on('data', function(data) {
		data = data.split('\n').join('');
		data = data.split('\t').join('');
		let cmd = data.split(' ')[0]
			, args = data.split(' ').slice(1, data.length);

		handleCmd(cmd, args)
	});
}

let handleCmd = (cmd, args) => {
	switch(cmd) {
		case 'scrape':
			let id = args[0];

			api.scrape(id);
			break;
		case 'getscid':
			let shandle = args[0];

			sc.findUser(shandle, user => {
				console.log(user)
			})
			break;
		case 'getfollowers':
			let fhandle = args[0];

			ig.getProfile(fhandle, opts => console.log(`${opts.followers} and ${opts.aviUrl}`));
			break;
		default:
			process.stdout.write('Unknown command. Type /help for a list of commands.\n');
			break;
	}
}

init();