const express = require('express')
const cors = require('cors')
const path = require('path')
const { initDB } = require('./db/database')
const { start: startCron } = require('./cron')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/jobs', require('./routes/jobs'))
app.use('/api/scrape', require('./routes/scrape'))
app.use('/api/apply', require('./routes/apply'))
app.use('/api/push', require('./routes/push'))

// Sert le front en production (build)
const clientDist = path.join(__dirname, '../client/dist')
if (require('fs').existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')))
}

initDB()
startCron()

app.listen(PORT, () => {
  console.log(`SMTM Emma — serveur démarré sur http://localhost:${PORT}`)
})
