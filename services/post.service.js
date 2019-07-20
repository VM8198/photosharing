const postModel = require('../model/post.model');
const userModel = require('../model/user.model');
const hashTagModel = require('../model/hashtag.model');
const ObjectId = require('mongodb').ObjectId;
const _ = require('lodash');
/**
 * @param {object} postData
 * Add Post
 */
module.exports.addPost = (postData, file) => {
    console.log("=======", postData);
    return new Promise((resolve, reject) => {
        const Post = new postModel(postData);
        Post.save((err, post) => {
            if (err) {
                reject({ status: 500, message: 'Internal Serevr Error' });
            } else {
                console.log("file", file);
                console.log("============postData===============>", typeof postData, postData);
                let hashTag = JSON.parse(postData.hashTag);
                console.log('hashtags===================>', hashTag);
                _.forEach(hashTag, function (tag) {
                    console.log('tag===============>', tag);
                    hashTagModel.findOne({ hashTag: tag })
                        .exec((err, foundTag) => {
                            if (err) {
                                reject({ status: 500, message: 'Internal Serevr Error' });
                                console.log('err------------------>', err);
                            } else if (foundTag) {
                                console.log('foundTag===============>', foundTag);
                                foundTag.count++;
                                foundTag.save();
                            } else {
                                console.log("==================not found======================")
                                let data = {
                                    hashTag: tag,
                                    count: 1
                                }
                                let hashnew = new hashTagModel(data);
                                hashnew.save();
                            }
                        })
                })
                postData.images = file.filename;
                postModel.findOneAndUpdate({ _id: post._id }, { $set: postData }, { upsert: true, new: true }).exec((error, post) => {
                    if (error) {
                        reject({ status: 500, message: 'Internal Serevr Error' });
                    } else {
                        console.log("post==============================>", post);
                        resolve({ status: 200, message: ' Post Added Successfully', data: post });
                    }
                })
            }
        })
    })
}

/**
 * @param {String} _pageNumber,offset
 * Get All Posts
 */
module.exports.getAllPost = (offset, _pageSize) => {
    console.log("=======", offset)
    return new Promise((resolve, reject) => {
        postModel.aggregate([
            { $match: { 'isDelete': false } },
            // Find not Delted Post
            {
                $project: {
                    _id: '$_id',
                    images: 1,
                    created_date: 1
                }
            },
            // project for get only needed Field
            { '$sort': { 'created_date': -1 } },
            { $skip: ((offset - 1) * _pageSize) },
            // skip post depending on offset
            { $limit: _pageSize },
            // send only 10 Post in every request
        ])
            .exec((err, posts) => {
                if (err) {
                    reject({ status: 500, message: 'Internal Serevr Error' });
                } else {
                    console.log('all post====================>', posts.length)
                    resolve({ status: 200, message: 'All Post Fetched', data: posts });
                }
            })
    })
}

/**
 * @param {String} userId
 * get pists by user id
 */
module.exports.getPostByUserId = (userId) => {
    return new Promise((resolve, reject) => {
        console.log("userId============>", userId)
        userModel.aggregate([
            { $match: { '_id': ObjectId(userId) } },
            {
                $lookup: {
                    from: 'posts',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'post'
                }
            },
            // Lookup form posts 
            {
                $unwind: {
                    path: '$post',
                    preserveNullAndEmptyArrays: true
                }
            },
            //Unwind Post to make object form Array
            { $match: { "post.isDelete": false } },
            // Find only not deleted post
            {
                $group: {
                    _id: '$_id',
                    name: { $first: '$name' },
                    friends: { $first: '$friends' },
                    followers: { $first: '$followers' },
                    userName: { $first: '$userName' },
                    email: { $first: '$email' },
                    profilePhoto: { $first: '$profilePhoto' },
                    post: {
                        $push: '$post',
                    },
                }
            },
            // Group to get users All Post in post Array 

        ])
            .exec((err, post) => {
                if (err) {
                    reject({ status: 500, message: 'Internal Serevr Error' });
                } else {
                    console.log('post===========================>', post);
                    resolve({ status: 200, message: ' Post Fetched', data: post });
                }
            })
    })
}
/**
 * @param {object} postData
 * update post by id
 */
module.exports.updatePostById = (data) => {
    return new Promise(async (resolve, reject) => {
        console.log("=======hashtag==========", data.hashTag)
        if (data.hashTag) {
            let hastag = data.hashTag.map((tag) => updateHashTag(tag));
            console.log("tag=======================>", hastag)
            hashTagData = await Promise.all(hastag);
        }
        function updateHashTag(tag) {
            return new Promise((resolve, reject) => {
                hashTagModel.findOneAndUpdate({ 'hashTag': tag }, { $inc: { count: 1 } }, { upsert: true, new: true })
                    .exec((err, foundTag) => {
                        if (err) {
                            const data = {
                                hashTag: tag,
                                count: 1
                            }
                            const hashnew = new hashTagModel(data);
                            hashnew.save();
                            console.log('err------------------>', err);
                            resolve("Hashtag saved");

                        } else {
                            resolve("Hashtag updated");
                            console.log("==================not found======================", foundTag)

                        }
                    })
            });
        }
        postModel.findOneAndUpdate({ _id: data.postId }, data, { upsert: true, new: true }, function (err, post) {
            if (err) {
                reject({ status: 500, message: 'Internal Serevr Error' });
            } else {
                console.log('post======================>', post);
                resolve({ status: 200, message: 'Post Upadate successfully', data: post });
            }
        });
    })
}

/**
 * @param {String} postId
 * Get Post by POstId
 */
module.exports.getPostBYPostId = (postId) => {
    return new Promise((resolve, reject) => {
        postModel.aggregate([
            {
                $match: { '_id': ObjectId(postId) }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userId'
                }
            },
            {
                $unwind: {
                    path: '$userId',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'comments',
                    localField: 'comment',
                    foreignField: '_id',
                    as: 'comment'
                }
            },
            {
                $unwind: {
                    path: '$comment',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'comment.userId',
                    foreignField: '_id',
                    as: 'comment.userId'
                }
            },
            {
                $unwind: {
                    path: '$comment.userId',
                    preserveNullAndEmptyArrays: true,
                }
            },
            {
                $group: {
                    _id: '$_id',
                    userId: { $first: '$userId' },
                    like: { $first: '$like' },
                    comment: { $push: '$comment' },
                    content: { $first: '$content' },
                    created_date: { $first: '$created_date' },
                    isLiked: { $first: '$isLiked' },
                    images: { $first: '$images' },
                }
            },
        ]).exec((err, post) => {
            if (err) {
                console.log("errrr============>", err)
                reject({ status: 500, message: 'Internal Serevr Error' });
            } else {
                console.log('post========================>', post);
                resolve({ status: 200, message: 'Post Fetched', data: post });
            }
        })
    })
}
/**
 * @param {String} postId
 * Delete POst
 */
module.exports.deletePost = (postId) => {
    console.log('postId in delete post=====>', postId)
    return new Promise((resolve, reject) => {
        postModel.findOneAndUpdate({ _id: postId }, { $set: { isDelete: true } }, { upsert: true, new: true }, function (err, post) {
            if (err) {
                reject({ status: 500, message: 'Internal Serevr Error' });
            } else {
                console.log('post============>', post);
                resolve({ status: 200, message: 'Post Deleted Successfully', data: post });
            }
        })
    })
}

/**
 * @param {String} userId
 * get Friends Post
 */
module.exports.getMyFriendsPost = (userId) => {
    return new Promise((resolve, reject) => {
        userModel.aggregate([
            {
                $match: { '_id': ObjectId(userId) }
            },
            {
                $lookup: {
                    from: 'posts',
                    localField: 'friends',
                    foreignField: 'userId',
                    as: 'post'
                }
            },
            //lookup from post to get friends posts
            {
                $unwind: {
                    path: '$post',
                    preserveNullAndEmptyArrays: true
                }
            },
            // unwind post to make object from Array
            {
                $lookup: {
                    from: 'users',
                    localField: 'post.userId',
                    foreignField: '_id',
                    as: 'post.userId'
                }
            },
            //lookup from user to get user details of particular post
            {
                $unwind: {
                    path: '$post.userId',
                    preserveNullAndEmptyArrays: true,
                }
            },
            //unwind userId to make object from Array 
            {
                $unwind: {
                    path: '$post.comment',
                    preserveNullAndEmptyArrays: true,
                }
            },
            //unwind comment to make object from Array 
            {
                $lookup: {
                    from: 'comments',
                    localField: 'post.comment',
                    foreignField: '_id',
                    as: 'post.comment'
                }
            },
            // lookup from comment to get post comment details
            {
                $unwind: {
                    path: '$post.comment',
                    preserveNullAndEmptyArrays: true
                }
            },
            // unwind comment to make object from Array 
            {
                $lookup: {
                    from: 'users',
                    localField: 'post.comment.userId',
                    foreignField: '_id',
                    as: 'post.comment.userId'
                }
            },
            //lookup from user to get userDetail in post's comment
            {
                $unwind: {
                    path: '$post.comment.userId',
                    preserveNullAndEmptyArrays: true,
                }
            },
            //unwind userId to make object from Array 
            {
                $group: {
                    _id: '$post._id',
                    userId: { $first: '$_id' },
                    name: { $first: '$name' },
                    friends: { $first: '$friends' },
                    followers: { $first: '$followers' },
                    userName: { $first: '$userName' },
                    email: { $first: '$email' },
                    profilePhoto: { $first: '$profilePhoto' },
                    comment: { $push: '$post.comment' },
                    friendsPost: { $first: '$post' },
                }
            },
            //group to get all comment together of particular post 
            { $sort: { 'friendsPost.created_date': -1 } },
            // fetch only not deleted post
            { $match: { 'friendsPost.isDelete': false } },
            // sort post by created date
            {
                $project: {
                    _id: '$userId',
                    name: 1,
                    friends: 1,
                    followers: 1,
                    userName: 1,
                    profilePhoto: 1,
                    email: 1,
                    friendsPost: {
                        _id: '$friendsPost._id',
                        userId: '$friendsPost.userId',
                        like: '$friendsPost.like',
                        isLiked: '$friendsPost.isLiked',
                        isDelete: '$friedsPost.isDelete',
                        comment: '$comment',
                        content: '$friendsPost.content',
                        created_date: '$friendsPost.created_date',
                        images: '$friendsPost.images',
                        sharePostCount: '$friendsPost.sharePostCount'
                    }
                }
            },
            //project to get needed field
            {
                $group: {
                    _id: '$_id',
                    name: { $first: '$name' },
                    friends: { $first: '$friends' },
                    followers: { $first: '$followers' },
                    userName: { $first: '$userName' },
                    email: { $first: '$email' },
                    profilePhoto: { $first: '$profilePhoto' },
                    friendsPost: {
                        $push: '$friendsPost'
                    }
                }
            },
            //grop to get All friends posts
        ])
            .exec((err, post) => {
                if (err) {
                    reject({ status: 500, message: 'Internal Serevr Error' });
                    console.log('err: ', err);
                } else {
                    console.log('friends posts======================>', post);
                    resolve({ status: 200, message: 'Post Deleted Successfully', data: post[0] });
                }
            })
    })
}
/**
 * @param {String} userId,postId
 * Like Post
 */
module.exports.likePost = (userId, postId) => {
    return new Promise((resolve, reject) => {
        postModel.findOne({ _id: postId })

            .exec((err, foundPost) => {
                if (err) {
                    reject({ status: 500, message: 'Internal Serevr Error' });
                }
                const index = foundPost.like.indexOf(userId);
                console.log("index===========================//>", index);
                if (index != -1) {
                    console.log("already liked");
                    foundPost.like.splice(index, 1);
                    foundPost.isLiked = false;
                    foundPost.save();
                    resolve({ status: 200, message: 'Liked Successfully', data: foundPost });
                } else {
                    console.log('foundpost========================>', foundPost);
                    foundPost.like.push(userId);
                    foundPost.isLiked = true;
                    foundPost.save();
                }
                resolve({ status: 200, message: 'Liked Successfully', data: foundPost });
            })
    })
}

/**
 * @param {String}key
 * Search Post
 */
module.exports.searchPost = (key) => {
    return new Promise((resolve, reject) => {
        postModel.aggregate([
            {
                $match: { $and: [{ 'content': { $regex: key, $options: 'i' } }, { 'isDelete': false }] }
            },
            //find post which hastag start with key and not deleted post
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userId'
                }
            },
            // lookup from user to get userDetails
            {
                $unwind: {
                    path: '$userId',
                    preserveNullAndEmptyArrays: true,
                }
            },
            //Unwind userId to make object from Array
            {
                $lookup: {
                    from: 'comments',
                    localField: 'comment',
                    foreignField: '_id',
                    as: 'comment'
                }
            },
            //lookup from comment to get comment of this post
            {
                $unwind: {
                    path: '$comment',
                    preserveNullAndEmptyArrays: true
                }
            },
            //Unwind comment to make object from Array
            {
                $lookup: {
                    from: 'users',
                    localField: 'comment.userId',
                    foreignField: '_id',
                    as: 'comment.userId'
                }
            },
            //lookup from user to get userDetails of those comment 
            {
                $unwind: {
                    path: '$comment.userId',
                    preserveNullAndEmptyArrays: true,
                }
            },
            //Unwind userId to make object from Array
            {
                $group: {
                    _id: '$_id',
                    userId: { $first: '$userId' },
                    like: { $first: '$like' },
                    comment: { $push: '$comment' },
                    content: { $first: '$content' },
                    created_date: { $first: '$created_date' },
                    isLiked: { $first: '$isLiked' },
                    images: { $first: '$images' },
                }
            },
        ])
            .exec((err, foundPost) => {
                if (err) {
                    reject({ status: 500, message: 'Internal Serevr Error' });
                    console.log('err: ', err);
                } else {
                    console.log('friends posts======================>', foundPost);
                    resolve({ status: 200, message: 'Search post fetched', data: foundPost });
                }
            })
    })
}