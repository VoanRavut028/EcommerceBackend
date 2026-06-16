import mongoose from "mongoose";

interface ICategories {
  title: string;
  slug: string;
  is_active: boolean;
}

const categorySchema = new mongoose.Schema<ICategories>({
  title: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
  },
  is_active: {
    type: Boolean,
    default: false,
  },
});

export default mongoose.model("Category", categorySchema);
