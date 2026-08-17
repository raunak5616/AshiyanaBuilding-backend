import { slideRepository } from '../../repositories/slide.repository.js';
import { cloudinaryService } from '../../services/cloudinary.service.js';
import { ApiError } from '../../utils/ApiError.js';

const sanitizeSlide = (doc) => ({
  id: doc._id,
  shopId: doc.shopId,
  imageUrl: doc.imageUrl,
  publicId: doc.publicId,
  categoryId: doc.categoryId,
  isActive: doc.isActive,
  createdAt: doc.createdAt,
});

const createSlide = async (shopId, file, categoryId) => {
  if (!file) {
    throw ApiError.badRequest('Slide image file is required', 'IMAGE_REQUIRED');
  }

  const uploadResult = await cloudinaryService.uploadImage(file, 'slides');
  
  const slide = await slideRepository.create({
    shopId,
    imageUrl: uploadResult.url,
    publicId: uploadResult.publicId,
    categoryId: categoryId || null,
  });

  return sanitizeSlide(slide);
};

const listSlides = async (shopId) => {
  const slides = await slideRepository.findAllByShop(shopId, { isActive: true });
  return slides.map(sanitizeSlide);
};

const deleteSlide = async (shopId, slideId) => {
  const slide = await slideRepository.findById(slideId, { shopId });
  if (!slide) {
    throw ApiError.notFound('Slide not found', 'SLIDE_NOT_FOUND');
  }

  if (slide.publicId) {
    await cloudinaryService.deleteImage(slide.publicId);
  }

  await slideRepository.model.deleteOne({ _id: slideId, shopId });
  return { success: true, message: 'Slide deleted successfully' };
};

export const slideService = {
  createSlide,
  listSlides,
  deleteSlide,
};
