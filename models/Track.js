let mongoose = require('mongoose')
	, Schema = mongoose.Schema;

let trackSchema = new Schema({
	id: Number,
	profileId: {
		ref: 'Profile',
		type: String
	},
	platform: String, // soundcloud / spotify
	genre: String,
	title: String,
	link: String,
	description: String,
	streams: Number,
	createdAt: Number
})

module.exports = mongoose.model('Track', trackSchema);