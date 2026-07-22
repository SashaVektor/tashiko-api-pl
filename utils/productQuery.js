const searchableFields = [
  "item_code",
  "position_name",
  "position_name_ukr",
  "search_queries",
  "search_queries_ukr",
  "description",
  "description_ukr",
  "product_type",
  "group_name",
  ...Array.from(
    { length: 14 },
    (_, index) => `value_characteristics${index + 1}`,
  ),
];

export const normalizeSearchQuery = (value = "") =>
  String(value).normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 120);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const createSearchRegex = (value) =>
  new RegExp(escapeRegex(normalizeSearchQuery(value)), "i");

export const buildProductFilter = ({ query, groupName }) => {
  const filter = { item_code: { $nin: [null, "", "item_code"] } };

  if (groupName) filter.group_name = groupName;

  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return filter;

  const rawTokens = normalizedQuery.split(" ").filter(Boolean);
  const compactQuery = normalizedQuery.replace(/[\s-]+/g, "");
  const isSpacedSku =
    /\d/.test(compactQuery) &&
    rawTokens.length > 1 &&
    rawTokens.every((token) => token.replace(/-/g, "").length <= 3);
  const tokens = isSpacedSku ? [compactQuery] : rawTokens;
  filter.$and = tokens.map((token) => {
    const escapedToken = escapeRegex(token);
    const compactToken = token.replace(/[\s-]+/g, "");
    const skuPattern = /\d/.test(compactToken)
      ? escapeRegex(compactToken).split("").join("[\\s-]*")
      : escapedToken;

    return {
      $or: searchableFields.map((field) => ({
        [field]: {
          $regex: field === "item_code" ? skuPattern : escapedToken,
          $options: "i",
        },
      })),
    };
  });

  return filter;
};

export const getProductSort = (sort = "availability", language = "pl") => {
  const nameField = language === "ua" ? "position_name_ukr" : "position_name";

  switch (sort) {
    case "alphabetical-asc":
      return { [nameField]: 1, item_code: 1 };
    case "alphabetical-desc":
      return { [nameField]: -1, item_code: 1 };
    case "availability":
    default:
      return { quantity: -1, [nameField]: 1, item_code: 1 };
  }
};

export const getPagination = (pageValue, limitValue) => {
  const page = Math.max(Number.parseInt(pageValue, 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(limitValue, 10) || 20, 1),
    100,
  );

  return { page, limit, skip: (page - 1) * limit };
};

export const getCollation = (language = "pl") => ({
  locale: language === "pl" ? "pl" : language === "ru" ? "ru" : "uk",
  strength: 1,
  numericOrdering: true,
});
