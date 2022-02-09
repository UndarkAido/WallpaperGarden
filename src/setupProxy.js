const proxy = require('http-proxy-middleware').createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true,
});

module.exports = function (app) {
    app.use(
        '/images',
        proxy
    );
    app.use(
        '/api',
        proxy
    );
};
