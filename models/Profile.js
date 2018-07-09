let mongoose = require('mongoose')
	, Schema = mongoose.Schema;

let profileSchema = new Schema({
	name: String,
	aliases: Array,
	age: Number,
	fans: Number,
	avatarUrl: String,
	genres: Array,
	
	fans: Number,
	streams: Number,

	newFans: Number,
	newStreams: Number,

	virality: Number,

	instagram: {
		type: Number,
		ref: 'Instagram'
	},

	soundcloud: {
		type: Number,
		ref: 'SoundCloud'
	},

	spotify: {
		type: Number,
		ref: 'Spotify'
	}
})

profileSchema.pre('save', function save(next) {
	const profile = this;
	if(!profile.isModified('createdAt')) profile.createdAt = Date.now();
	next();
});

module.exports = mongoose.model('Profile', profileSchema);