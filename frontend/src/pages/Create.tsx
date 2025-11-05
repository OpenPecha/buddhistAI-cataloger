import EnhancedTextCreationForm from "@/components/text-creation/EnhancedTextCreationForm";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Create = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-blue-800">
          Create New Text
        </h1>
        <Button onClick={() => navigate("/")} variant="outline">
          ← Back to Home
        </Button>
      </div>

      {/* Form */}
      <EnhancedTextCreationForm />
    </div>
  );
};

export default Create;

