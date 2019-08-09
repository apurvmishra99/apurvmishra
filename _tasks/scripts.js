const config = require('./_config.json')
const gulp = require('gulp')
const rename = require('gulp-rename')
const terser = require('gulp-terser')
const webpack = require('webpack-stream')

const webpackConfig = {
    entry: {
        main: `./${config.assetSrc}/scripts/main.js`,
        webmentions: `./${config.assetSrc}/scripts/webmentions/index.js`,
        sharer: `./${config.assetSrc}/scripts/sharer/index.js`
    },
    output: {
        filename: '[name].js'
    },
    module: {
        rules: [
            {
                test: /\.m?js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                        plugins: [
                            [
                                '@babel/plugin-transform-react-jsx',
                                { pragma: 'h' }
                            ]
                        ]
                    }
                }
            }
        ]
    }
}

gulp.task('scripts', function() {
    return gulp
        .src(config.assetSrc + '/scripts/main.js')
        .pipe(webpack(webpackConfig))
        .pipe(terser())
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest(config.assetDest + '/js'))
})
