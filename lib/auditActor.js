function resolveAuditActor(req) {
  const user = req && req.user;
  if (user && user.uid != null) {
    return {
      actor_id: String(user.uid),
      actor_name: String(user.username || user.uid),
    };
  }
  return {
    actor_id: "system",
    actor_name: "System",
  };
}

module.exports = {
  resolveAuditActor,
};
