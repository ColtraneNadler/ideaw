let mongoose = require('mongoose')
	, Schema = mongoose.Schema
	, ObjectID = Schema.Types.ObjectId;

let instagramSnapshotSchema = new Schema({
	_id: Number, //id
	
	// this week (concatenated snapshots will just be the newest createdAt for these)
	followers: Number,
	averageLikes: Number,
	averageComments: Number,


	//these will be added up over time
	// notable engagements from this week
	notableEngagements: Array,
	/* either like: {
		_id: id, //the id of the action iteseg
		influencer: ref _id  //the id of the person
	}
	or comment: {
	    _id: id,
		influencer: ref _id,
	    text: 'the comment'
	}
	so typeof determines what it is
	*/

	// notable followers from this week
	notableFollowers: Array, //int array of ids
	
	createdAt: Number
})

instagramSnapshotSchema.pre('save', function save(next) {
	const instagramSnapshot = this;
	if(!instagramSnapshot.isModified('createdAt')) instagramSnapshot.createdAt = Date.now();
	next();
});

module.exports = mongoose.model('InstagramSnapshot', instagramSnapshotSchema);