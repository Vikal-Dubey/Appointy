import jwt from 'jsonwebtoken'

// user authentication middleware
const authUser = async (req, res, next) => {
    const authHeader = req.headers.authorization
    const tokenFromHeader = req.headers.token
    const token = authHeader?.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : tokenFromHeader

    if (!token) {
        return res.json({ success: false, message: 'Not Authorized Login Again' })
    }

    try {
        const token_decode = jwt.verify(token, process.env.JWT_SECRET)
        const userId = token_decode.id?.toString()

        if (!userId) {
            return res.json({ success: false, message: 'Not Authorized Login Again' })
        }

        req.userId = userId
        if (!req.body || typeof req.body !== 'object') {
            req.body = {}
        }
        req.body.userId = userId

        next()
    } catch (error) {
        console.log(error)
        return res.json({ success: false, message: 'Not Authorized Login Again' })
    }
}

export default authUser
