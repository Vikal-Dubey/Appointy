import jwt from "jsonwebtoken"

// admin authentication middleware
const authAdmin = async (req, res, next) => {
    try {
        const { atoken } = req.headers
        if (!atoken) {
            return res.json({ success: false, message: 'Not Authorized Login Again' })
        }

        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
        const adminPassword = process.env.ADMIN_PASSWORD?.trim()

        if (!adminEmail || !adminPassword || !process.env.JWT_SECRET) {
            return res.json({ success: false, message: 'Admin credentials are not configured on server' })
        }

        const token_decode = jwt.verify(atoken, process.env.JWT_SECRET)
        if (token_decode !== adminEmail + adminPassword) {
            return res.json({ success: false, message: 'Not Authorized Login Again' })
        }
        next()
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export default authAdmin;