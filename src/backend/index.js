import express from 'express'
import cors from 'cors'
import { httpServerHandler } from 'cloudflare:node';
import { env } from 'cloudflare:workers';
import { registerRoutes } from './routes.js'

const app = express();
app.use(express.json())

const devDomain = env.DEV_DOMAIN
const stagingDomain = env.STAGING_DOMAIN
const prodDomain = env.PROD_DOMAIN

// DEV_DOMAIN, STAGING_DOMAIN and PROD_DOMAIN are injected by hyperDart after
// publishing. Do not remove them.
const allowedOrigins = [
  devDomain,
  stagingDomain,
  prodDomain
].filter(Boolean)

// Any localhost port is allowed so the local sandbox works on any port.
const localOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || localOrigin.test(origin) || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}))

app.get('/api/message', (req, res) => {
  res.json({ message: 'Hello from Express on Workers!' })
})

registerRoutes(app)

app.listen(3000)
export default httpServerHandler({ port: 3000 })