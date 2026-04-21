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

        if (!req.body) req.body = {}
        req.body.userId = token_decode.id

        next()
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: 'Not Authorized Login Again' })
    }
}

export default authUser