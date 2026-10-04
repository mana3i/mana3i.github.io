module.exports = (app) => {
  app.get('/cleanfolio*', (req, res) => {
    res.redirect('/')
  })
}
