import jwt from 'jsonwebtoken';

// Doctor authentication middleware
const authDoctor = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization
        const dtoken = req.headers.dtoken
        const tokenHeader = req.headers.token

        let token = null

        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1]
        } else if (authHeader) {
            token = authHeader
        } else if (dtoken) {
            token = dtoken
        } else if (tokenHeader) {
            token = tokenHeader
        }

        if (!token) {
            return res.json({ success: false, message: 'Authorization token missing' })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const docId = decoded.id?.toString()

        if (!docId) {
            return res.json({ success: false, message: 'Invalid or expired token' })
        }

        req.user = { id: docId }
        next()
    } catch (error) {
        console.error('Auth Error:', error.message)
        return res.json({ success: false, message: 'Invalid or expired token' })
    }
};

export default authDoctor;
