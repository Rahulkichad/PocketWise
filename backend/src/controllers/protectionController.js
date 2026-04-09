import {
  getEmergencyFundSnapshot,
  listInsuranceWithDerived,
  upsertInsurance,
  deleteInsurance,
} from "../services/protectionService.js";

export async function emergencyFundCtrl(req, res, next) {
  try {
    const data = await getEmergencyFundSnapshot(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function listInsuranceCtrl(req, res, next) {
  try {
    const data = await listInsuranceWithDerived(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function upsertInsuranceCtrl(req, res, next) {
  try {
    const item = await upsertInsurance(req.user.id, req.body);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

export async function deleteInsuranceCtrl(req, res, next) {
  try {
    await deleteInsurance(req.user.id, req.params.type);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
