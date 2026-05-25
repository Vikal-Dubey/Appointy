import jwt from "jsonwebtoken"

// admin authentication middleware
const authAdmin = async (req, res, next) => {
    try {
        // Express lowercases header keys; accept aToken from client as atoken
        const atoken = req.headers.atoken || req.headers['atoken']

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
        return res.json({ success: false, message: 'Not Authorized Login Again' })
    }
}

export default authAdmin
