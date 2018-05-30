let fs 				= require('fs')
	, Client 		= require('instagram-private-api').V1
	, device 		= new Client.Device('chrome')
	, session;

if(!fs.existsSync('cookies'))
	fs.mkdirSync('cookies');

function clearCookies() {
	fs.writeFileSync('cookies/cookie.json', '');
}

let storage = new Client.CookieFileStorage('./cookies/cookie.json');

Client.Session.create(device, storage, '10mileswest', 'westmiles01')
	.then(session => {
		session = session;

		Client.Account.searchForUser(session, 'thelabcook')
			.then(user => {
				let feed = new Client.Feed.AccountFollowers(session, user.id);

				feed.get()
					.then(followers => console.log(followers.length))
			});
	})
	.catch(err => {
		console.log(err);
	})