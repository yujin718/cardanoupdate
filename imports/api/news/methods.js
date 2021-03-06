import { Meteor } from 'meteor/meteor'
import SimpleSchema from 'simpl-schema'
import { ValidatedMethod } from 'meteor/mdg:validated-method'

import { News } from './news'
import { Comments } from '/imports/api/comments/comments'

import { isModerator, userStrike } from '/imports/api/user/methods'

import { sendNotification } from '/imports/api/notifications/methods'

// get number of votes by type
const numVotes = (votes, voteType) => {
    return (votes.filter(i => i.vote === voteType)).length
}


export const addToSubscribers = (newsId, userId) => {
    let news = News.findOne({
        _id: newsId
    })

    News.update({
        _id: newsId
    }, {
        $addToSet: {
            subscribers: userId
        }
    })
}

export const sendToSubscribers = (newsId, authorId, message) => {
    let news = News.findOne({
        _id: newsId
    })

    if (news && news.subscribers && news.subscribers.length) {
        news.subscribers.forEach(i => {
            if (i !== authorId) { // don't notify yourself
                sendNotification(i, message, 'System', `/news/${news.slug}`)
            }
        })
    }
  
    return news.subscribers
}

export const addNews = new ValidatedMethod({
    name: 'addNews',
    validate:
        new SimpleSchema({
            headline: {
                type: String,
                max: 140,
                optional: false
            },
            summary: {
                type: String,
                max: 500,
                optional: false
            },
            body: {
                type: String,
                optional: false
            },
            image: {
                type: String,
                optional: true
            },
            tags: {
                type: Array,
                optional: true
            },
            "tags.$": {
                type: String,
                optional: true
            }
        }).validator({
            clean: true
        }),
    run({ headline, summary, body, image, tags }) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('Error.', 'You have to be logged in.')
		}

        return News.insert({
            headline: headline,
            summary: summary,
            body: body,
            tags: tags,
            createdAt: new Date().getTime(),
            createdBy: Meteor.userId(),
            subscribers: [Meteor.userId()],
            votes: [{
                vote: 'up',
                votedBy: Meteor.userId(),
                votedAt: new Date().getTime()
            }, {
                vote: 'up',
                votedBy: 'System',
                votedAt: new Date().getTime()
            }],
            image: image || ''
        })
    }
})

export const removeNews = new ValidatedMethod({
    name: 'removeNews',
    validate:
        new SimpleSchema({
            newsId: {
                type: String,
                optional: false
            }
        }).validator(),
    run({ newsId }) {
        let news = News.findOne({
            _id: newsId
        })

        if (!news) {
            throw new Meteor.Error('Error.', 'News doesn\'t exist.')
        }

        if (!Meteor.userId()) {
            throw new Meteor.Error('Error.', 'You have to be logged in.')
        }

        if (news.createdBy !== Meteor.userId()) {
            throw new Meteor.Error('Error.', 'You can\'t remove news that you haven\'t posted.')
        }

        Comments.remove({
            newsId: newsId
        })

        return News.remove({
            _id: newsId
        })
    }
})

export const editNews = new ValidatedMethod({
    name: 'editNews',
    validate:
        new SimpleSchema({
            newsId: {
                type: String,
                optional: false
            },
            headline: {
                type: String,
                max: 140,
                optional: false
            },
            summary: {
                type: String,
                max: 500,
                optional: false
            },
            body: {
                type: String,
                optional: false
            },
            image: {
                type: String,
                optional: true
            },
            tags: {
                type: Array,
                optional: true
            },
            "tags.$": {
                type: String,
                optional: true
            }
        }).validator({
            clean: true
        }),
    run({ newsId, headline, summary, body, image, tags }) {
        let news = News.findOne({
            _id: newsId
        })

        if (!news) {
            throw new Meteor.Error('Error.', 'News doesn\'t exist.')
        }

        if (!Meteor.userId()) {
            throw new Meteor.Error('Error.', 'You have to be logged in.')
        }

        if (news.createdBy !== Meteor.userId()) {
            throw new Meteor.Error('Error.', 'You can\'t edit news that you haven\'t posted.')
        }

        return News.update({
            _id: newsId
        }, {
            $set: {
                headline: headline,
                summary: summary,
                body: body,
                tags: tags,
                editedAt: new Date().getTime(),
                image: image || ''
            }
        })
    }
})

export const flagNews = new ValidatedMethod({
    name: 'flagNews',
    validate:
        new SimpleSchema({
            newsId: {
                type: String,
                optional: false
            },
            reason: {
                type: String,
                max: 1000,
                optional: false
            }
        }).validator({
            clean: true
        }),
    run({ newsId, reason }) {
        let news = News.findOne({
            _id: newsId
        })

        if (!news) {
            throw new Meteor.Error('Error.', 'News doesn\'t exist.')
        }

        if (!Meteor.userId()) {
            throw new Meteor.Error('Error.', 'You have to be logged in.')
        }
      
        if ((news.flags || []).some(i => i.flaggedBy === Meteor.userId())) {
            throw new Meteor.Error('Error.', 'You have already flagged this item.')
        }

        return News.update({
            _id: newsId
        }, {
            $push: {
                flags: {
                    reason: reason,
                    flaggedBy: Meteor.userId(),
                    flaggedAt: new Date().getTime()
                }
            }
        })
    } 
})

export const toggleWatchNews = new ValidatedMethod({
    name: 'toggleWatchNews',
    validate:
        new SimpleSchema({
            newsId: {
                type: String,
                optional: false
            }
        }).validator({
            clean: true
        }),
    run({ newsId }) {
        let news = News.findOne({
            _id: newsId
        })

        if (!news) {
            throw new Meteor.Error('Error.', 'News doesn\'t exist.')
        }

        if (!Meteor.userId()) {
            throw new Meteor.Error('Error.', 'You have to be logged in.')
        }

        return News.update({
            _id: newsId
        }, {
            [!~(news.subscribers || []).indexOf(Meteor.userId()) ? '$addToSet' : '$pull']: {
                subscribers: Meteor.userId()
            }
        })
    }
})

export const resolveNewsFlags = new ValidatedMethod({
    name: 'resolveNewsFlags',
    validate:
        new SimpleSchema({
            newsId: {
                type: String,
                optional: false
            },
            decision: {
                type: String,
                optional: false
            }
        }).validator({
            clean: true
        }),
    run({ newsId, decision }) {
        if (!Meteor.userId()) {
            throw new Meteor.Error('Error.', 'You have to be logged in.')
        }

        if (!isModerator(Meteor.userId())) {
            throw new Meteor.Error('Error.', 'You have to be a moderator.')
        }

        let news = News.findOne({
            _id: newsId
        })

        if (!news) {
            throw new Meteor.Error('Error.', 'News doesn\'t exist.')
        }

        if (decision === 'ignore') {
            return News.update({
                _id: newsId
            }, {
                $set: {
                    flags: []
                }
            })
        } else {
            userStrike.call({
                userId: news.createdBy,
                type: 'news',
                token: 's3rv3r-only',
                times: 1
            }, (err, data) => {})
            
            Comments.remove({
                newsId: newsId
            })

            return News.remove({
                _id: newsId
            })
        }
    }
})

export const voteNews = new ValidatedMethod({
    name: 'voteNews',
    validate:
        new SimpleSchema({
            newsId: {
                type: String,
                optional: false
            },
            vote: {
                type: String,
                optional: false
            }
        }).validator({
            clean: true
        }),
    run({ newsId, vote }) {
        let news = News.findOne({
            _id: newsId
        })

        if (!news) {
            throw new Meteor.Error('Error.', 'News doesn\'t exist.')
        }

        if (!Meteor.userId()) {
            throw new Meteor.Error('Error.', 'You have to be logged in.')
        }

        // check if user has already voted, update vote if true
        if (news.votes && (news.votes.filter(i => i.votedBy === Meteor.userId())).length !== 0) {
            News.update({
                _id : newsId,
                'votes.votedBy' : Meteor.userId()
            }, {
                $set: {
                    'votes.$.vote' : vote,
                    'votes.$.votedAt' : new Date().getTime()
                }
            })
        } else {
            // if user has not voted we push the new vote into the votes array
            News.update({ _id: newsId }, {
                $push: {
                    votes: {
                        vote: vote,
                        votedBy: Meteor.userId(),
                        votedAt: new Date().getTime()
                    }
                }
            })
        }

        // get the updated news with updated/new vote
        updatedNews = News.findOne({ _id: newsId })
        const upvotes = numVotes(updatedNews.votes, 'up')
        const downvotes = numVotes(updatedNews.votes, 'down')

        // update News rating
        return News.update({ _id : newsId}, {
            $set: {
                rating: (upvotes - downvotes)/updatedNews.votes.length,
            }
        })

    }
})

if (Meteor.isDevelopment) {
    Meteor.methods({
        generateTestFlagged: () => {
            for (let i = 0; i < 2; i++) {
                News.insert({
                    headline: `Flagged ${i}`,
                    summary: 'Test',
                    body: 'Test',
                    createdBy: 'test',
                    createdAt: new Date().getTime()
                })
            }
        },
        removeTestFlagged: () => {
            for (let i = 0; i < 2; i++) {
                News.remove({
                    headline: `Flagged ${i}`
                })
            }
        }
    })
}
