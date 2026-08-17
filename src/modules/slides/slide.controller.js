import { slideService } from './slide.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const create = asyncHandler(async (req, res) => {
  const { categoryId } = req.body;
  const slide = await slideService.createSlide(req.user.shopId, req.file, categoryId);
  return res.status(201).json(new ApiResponse(201, 'Slide uploaded successfully', slide));
});

const list = asyncHandler(async (req, res) => {
  const shopId = req.user?.shopId || req.query.shopId || '60b9f15c7c2b5d4e6f8a9b1c';
  const slides = await slideService.listSlides(shopId);
  return res.status(200).json(new ApiResponse(200, 'Slides fetched successfully', slides));
});

const deleteById = asyncHandler(async (req, res) => {
  const result = await slideService.deleteSlide(req.user.shopId, req.params.id);
  return res.status(200).json(new ApiResponse(200, result.message));
});

export const slideController = {
  create,
  list,
  deleteById,
};
