let mongoose = require('mongoose')
	, Schema = mongoose.Schema
	, ObjectID = Schema.Types.ObjectID;

let profileSnapshotSchema = new Schema({
	fans: Number
	streams: Number,

	profile: {
		type: ObjectID,
		ref: 'Profile'
	},

	createdAt: Number
})

module.exports = mongoose.model('ProfileSnapshot', profileSnapshotSchema);