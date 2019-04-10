---
title: "Static Indieweb pt1: Syndicating Content"
slug: "syndicating-content-to-twitter-with-netlify-functions"
tags: code
description: "How to automatically publish content from a static site on Twitter, using Eleventy and Netlify's lambda functions."
demo: https://github.com/maxboeck/mxb/blob/master/_lambda/deploy-succeeded.js
image: cover.jpg
---

<p class="lead">One of the core principles of the <a href="https://indieweb.org/">IndieWeb</a> is that people should own their own content. Controlling how and where they publish makes users more independent from big content silos.</p>

However, the main reason why people publish on Twitter / Medium or other platforms is that they can reach a much bigger audience there - everyone's on them, so you have to be too. Publishing on a personal site can cut you off from those readers. That's why it might be a good idea to automatically post copies of your content on these sites whenever you publish something new.

This practice is known as "<abbr title="Publish on Own Site, Syndicate Elsewhere">POSSE</abbr>" (Publish on your Own Site, Syndicate Elsewhere). It enables authors to reach people on other platforms while still keeping control of the original content source.

For the recent relaunch of my personal website, I wanted to embrace some of these ideas. I included a section called [notes](/notes) featuring small, random pieces of content - much like tweets. These notes are perfect candidates for syndication to Twitter.

## Syndication on Static Sites

My site is built with [Eleventy](https://11ty.io), a static site generator based on node, and hosted on [Netlify](https://netlify.com). Static sites are awesome for a variety of reasons, but interacting with other platforms typically requires some serverside code - which they don't have. 

Luckily though, Netlify provides a service called ["Functions"](https://www.netlify.com/docs/functions/), which lets you write custom AWS lambda functions without the hassle of dealing with AWS directly. Perfect! 🤘

## A content feed

The first step is to publish a machine-readable feed of the content we want to syndicate. That's exactly what RSS-Feeds are for - but they're usually in XML format, which is not ideal in this case.

For my own site, I chose to provide notes as a simple JSON object. I already have an atom feed for content readers, and JSON makes the note processing easier later on.

[My feed](https://mxb.dev/notes.json) looks something like this:

```js
// notes.json
[
    {
        "id": 1,
        "date": "2018-12-02T14:20:17",
        "url": "https://mxb.dev/notes/2018-12-02/",
        "content": "Here's my first note!",
        "syndicate": true
    },
    {...}
]
```

All entries also include a custom `syndicate` flag that overrides the auto-publishing behaviour if necessary.

## Event-Triggered Functions

Now for the tricky part: we need to write a lambda function to push new notes to Twitter. I won't go into detail on how to build lambda functions on Netlify, there are already some great tutorials about this:

* [Build and deploy a serverless function to Netlify](https://scotch.io/tutorials/build-and-deploy-a-serverless-function-to-netlify) (scotch.io)
* [Lambda functions playground](https://functions-playground.netlify.com/) (netlify.com)

💡 _Hint: also check out the [netlify-lambda cli](https://www.npmjs.com/package/netlify-lambda), a very handy tool to test and build your functions in development._

To trigger our custom function everytime a new version of the site was successfully deployed, we just need to name it `deploy-succeeded.js`. Netlify will then automatically fire it after each new build, while also making sure it's not executable from the outside.

Whenever that function is invoked, it should fetch the list of published notes from the JSON feed. It then needs to check if any new notes were published, and whether they should be syndicated to Twitter.

```js
// deploy-succeeded.js
exports.handler = async () => {
    return fetch('https://mxb.dev/notes.json')
        .then(response => response.json())
        .then(processNotes)
        .catch(err => ({
            statusCode: 422,
            body: String(err)
        }))
}
```

Since we will have to interact with the Twitter API, it's a good idea to use a dedicated helper class to take some of that complexity off our hands. The `twitter` [package on npm](https://www.npmjs.com/package/twitter) does just that. We will have to register for a [developer account](https://apps.twitter.com/) on Twitter first though, to get the necessary API keys and tokens. Store those in your project's `.env` file.

```bash
TWITTER_CONSUMER_KEY=YourTwitterConsumerKeyHere
TWITTER_CONSUMER_SECRET=YourTwitterConsumerSecretStringHere
TWITTER_ACCESS_TOKEN_KEY=12345678-YourTwitterAccessTokenKeyHere
TWITTER_ACCESS_TOKEN_SECRET=YourTwitterAccessTokenSecretStringHere
```

Use these keys to initialize your personal Twitter client, which will handle the posting for your account.

```js
// Configure Twitter API Client
const twitter = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
})
```

Right. Now we need to look at the `notes` array and figure out what to do. To keep it simple, let's assume the latest note is a new one we just pushed. Since the JSON feed lists notes in descending date order, that would be the first item in the array.

We can then search twitter for tweets containing the latest note's URL (we will include that in every syndicated tweet to link back to the original source). If we find anything, then it's already been published and we don't need to do anything. If not, we'll go ahead.

```js
const processNotes = async notes => {
    // assume the last note was not yet syndicated
    const latestNote = notes[0]

    // check if the override flag for this note is set
    if (!latestNote.syndicate) {
        return {
            statusCode: 400,
            body: 'Latest note has disabled syndication.'
        }
    }

    // check twitter for any tweets containing note URL.
    // if there are none, publish it.
    const search = await twitter.get('search/tweets', { q: latestNote.url })
    if (search.statuses && search.statuses.length === 0) {
        return publishNote(latestNote)
    } else {
        return {
            statusCode: 400,
            body: 'Latest note was already syndicated.'
        }
    }
}
```

Next, we need to prepare the tweet we want to send. Since our self-published note does not have the same restrictions that twitter has, we should format its content first. 

My implementation simply strips all HTML tags from the content, makes sure it is not too long for Twitter's limit, and includes the source url at the end. It's also worth noting that Eleventy will escape the output in the JSON feed, so characters like `"` will be encoded to `&quot;` entities. We need to reverse that before posting. 

```js
// Prepare the content string for tweet format
const prepareStatusText = note => {
    const maxLength = 200

    // strip html tags and decode entities
    let text = note.content.trim().replace(/<[^>]+>/g, '')
    text = entities.decode(text)

    // truncate note text if its too long for a tweet.
    if (text.length > maxLength) {
        text = text.substring(0, maxLength) + '...'
    }

    // include the note url at the end.
    text = text + ' ' + note.url
    return text
}
```

When everything is done, we just need to send our note off to Twitter:

```js
// Push a new note to Twitter
const publishNote = async note => {
    const statusText = prepareStatusText(note)
    const tweet = await twitter.post('statuses/update', {
        status: statusText
    })
    if (tweet) {
        return {
            statusCode: 200,
            body: `Note ${note.date} successfully posted to Twitter.`
        }
    }
}
```

Hopefully that all worked, and you should end up with something like this in your timeline:

<blockquote class="twitter-tweet" data-lang="de"><p lang="en" dir="ltr">I did some housekeeping over the holidays and switched my website to <a href="https://twitter.com/eleven_ty?ref_src=twsrc%5Etfw">@eleven_ty</a> and <a href="https://twitter.com/Netlify?ref_src=twsrc%5Etfw">@Netlify</a> !<br><br>👉 <a href="https://t.co/oq0OyPyjRs">https://t.co/oq0OyPyjRs</a></p>&mdash; Max Böck (@mxbck) <a href="https://twitter.com/mxbck/status/1081178633513910272?ref_src=twsrc%5Etfw">January 4, 2019</a></blockquote>

🎉 You can find the [finished lambda function](https://github.com/maxboeck/mxb/blob/master/_lambda/deploy-succeeded.js) along with the rest of the source code for this site on Github.

## Further Resources

* [Indieweb Notes](https://indieweb.org/note) The concept behind this.
* [eleventyone by Phil Hawksworth](https://github.com/philhawksworth/eleventyone) A starter for Eleventy sites, including lambda functions and `netlify-lambda`.
* [Twitter API Docs](https://developer.twitter.com/en/docs/tweets/post-and-engage/api-reference/post-statuses-update.html)