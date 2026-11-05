export function serialize(document) {
  const value = document.toObject({ versionKey: false })
  return { ...value, id: String(value._id), _id: undefined, userId: undefined }
}
