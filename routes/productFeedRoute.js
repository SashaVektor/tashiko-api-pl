import express from 'express'
import {
  getProductFeed,
  getProductsFeed,
  getProductsFeedByGroup,
  removeProductFeed,
  searchProductsFeed,
  getProductsFeedByGroupWithLimit,
  editProduct,
  getProductsByNumber,
  getProductsBrands,
} from '../controllers/productFeedController.js'

const productFeedRoute = express.Router()

productFeedRoute.get('/', getProductsFeed)

productFeedRoute.get('/brands/get-brands', getProductsBrands)

productFeedRoute.get('/:productCode', getProductFeed)

productFeedRoute.get('/search-number/:number', getProductsByNumber)

productFeedRoute.delete('/:id', removeProductFeed)

// productFeedRoute.post("/", createProduct);

productFeedRoute.patch('/', editProduct)

productFeedRoute.get('/productFeed/:groupName', getProductsFeedByGroup)

productFeedRoute.get(
  '/productFeed/limit/:groupName',
  getProductsFeedByGroupWithLimit,
)

productFeedRoute.get('/search/productFeed', searchProductsFeed)

export default productFeedRoute
