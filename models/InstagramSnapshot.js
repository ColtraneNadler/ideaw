let mongoose = require('mongoose')
	, Schema = mongoose.Schema
	, ObjectID = Schema.Types.ObjectId;

let instagramSnapshotSchema = new Schema({
	instagram: {
		type: Number,
		ref: 'Instagram'
	},
	profile: {
		type: ObjectID,
		ref: 'Profile'
	},
	
	// this week
	followers: Number,

	averageLikes: Number,
	averageComments: Number,

	// notable engagements from this week
	notableEngagements: Array,

	// notable followers from this week
	notableFollowers: Array,
	
	createdAt: Number
})

instagramSnapshotSchema.pre('save', function save(next) {
	const instagramSnapshot = this;
	if(!instagramSnapshot.isModified('createdAt')) instagramSnapshot.createdAt = Date.now();
	next();
});

module.exports = mongoose.model('InstagramSnapshot', instagramSnapshotSchema);