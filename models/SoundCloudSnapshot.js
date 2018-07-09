let mongoose = require('mongoose')
	, Schema = mongoose.Schema
	, ObjectID = Schema.Types.ObjectId;

let soundcloudSnapshotSchema = new Schema({
	followers: Number,
	following: Number,
	trackCount: Number,

	avgStreams: String,
	totalStreams: String,

	profile: {
		type: ObjectID,
		ref: 'Profile'
	},

	soundcloud: {
		type: Number,
		ref: 'SoundCloud'
	},

	createdAt: Number
})

soundcloudSnapshotSchema.pre('save', function save(next) {
	const soundcloudSnapshotSchema = this;
	if(!soundcloudSnapshotSchema.isModified('createdAt')) soundcloudSnapshotSchema.createdAt = Date.now();
	next();
});

module.exports = mongoose.model('SoundCloudSnapshot', soundcloudSnapshotSchema);