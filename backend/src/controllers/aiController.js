import axios from "axios";

export async function biasCtrl(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    const payload = { features: req.body?.features || {}, userId };
    const url = `${process.env.ML_SERVICE_URL || "http://localhost:8001"}/bias`;
    const { data } = await axios.post(url, payload, { timeout: 3000 });
    res.json(data);
  } catch (err) {
    next(err);
  }
}
