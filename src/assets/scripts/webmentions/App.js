import { h, Component } from 'preact'

import Webmention from './Webmention'
import Icon from './Icon'

export default class App extends Component {
    componentDidMount() {
        if (window.initLazyLoad && typeof window.initLazyLoad === 'function') {
            window.initLazyLoad()
        }
    }

    renderMentionsHeader(webmentions, likeCount) {
        const faces = webmentions.slice(0, 5).map((entry) => {
            const defaultAvatarSrc = '/assets/images/avatar-default.jpg'
            const imgSrc = entry.author.photo || defaultAvatarSrc
            return (
                <img
                    key={entry['wm-id']}
                    className="webmentions__faces__img"
                    src={defaultAvatarSrc}
                    data-src={imgSrc}
                    title={entry.author.name}
                    alt=""
                    width={32}
                    height={32}
                />
            )
        })
        if (webmentions.length > 5) {
            faces.push(
                <span className="webmentions__faces__more">
                    +{webmentions.length - 5}
                </span>
            )
        }
        return (
            <div className="webmentions__header">
                <span
                    className="webmentions__metric"
                    aria-label={`${likeCount} Likes`}
                >
                    <Icon name="heart" /> {likeCount}
                </span>
                <a
                    href="#webmentions"
                    className="webmentions__metric"
                    aria-label={`${webmentions.length} Mentions, show all`}
                >
                    <Icon name="message" /> {webmentions.length} (Show All)
                </a>
                <div className="webmentions__faces">{faces}</div>
                <a
                    href="https://indieweb.org/Webmention"
                    className="webmentions__info"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <Icon name="question" />
                    What’s this?
                </a>
            </div>
        )
    }

    renderMentionsList(webmentions) {
        return (
            <ol className="webmentions__list">
                {webmentions.map((item) => {
                    const {
                        'wm-id': id,
                        url,
                        author,
                        published,
                        content
                    } = item
                    return (
                        <li className="webmentions__item" key={id}>
                            <Webmention
                                id={id}
                                url={url}
                                author={author}
                                content={content}
                                published={published}
                            />
                        </li>
                    )
                })}
            </ol>
        )
    }

    render({ webmentions, likeCount }) {
        if (!webmentions.length) {
            return <p className="webmentions__empty">No webmentions yet.</p>
        }

        return (
            <div data-rendered>
                {this.renderMentionsHeader(webmentions, likeCount)}
                <div className="webmentions__content">
                    {this.renderMentionsList(webmentions)}
                </div>
            </div>
        )
    }
}
