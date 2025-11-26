import cloudinary
import cloudinary.uploader
import cloudinary.api

cloudinary.config(
    cloud_name="YOUR_CLOUD_NAME",
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET"
)

def get_image_for_entity(entity):
    try:
        result = cloudinary.Search().expression(entity).max_results(1).execute()
        resources = result.get("resources", [])
        if resources:
            return resources[0].get("secure_url")
    except Exception:
        pass
    return "https://via.placeholder.com/150"
