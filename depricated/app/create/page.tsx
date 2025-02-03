"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import ImageGallery from "@/components/image-gallery";
import { useParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { modelImages, garmentImages } from "@/lib/data";
import { uploadToCloudinary } from "@/lib/function";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import Link from "next/link";

export default function Create() {
  const { toast } = useToast();

  const [garmentImgUrl, setGarmentImgUrl] = useState<string | null>(null);
  const [modelImgUrl, setModelImgUrl] = useState<string | null>(null);
  const [genImageUrl, setGenImage] = useState<string | null>(null);
  const [garmentType, setGarmentType] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [numImages, setNumImages] = useState("1");

  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle file uploads
  const handleFileUpload = async (
    file: File,
    setUrl: (url: string) => void,
  ) => {
    try {
      setIsLoading(true);
      const cloudinaryUrl = await uploadToCloudinary(file);
      setUrl(cloudinaryUrl);
    } catch (error) {
      console.log("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Validate inputs before generation
  const validateInputs = (): boolean => {
    if (!garmentType) {
      toast({
        variant: "destructive",
        title: "Missing Input",
        description: "Please select the garment type.",
      });
      return false;
    }
    if (!garmentImgUrl) {
      toast({
        variant: "destructive",
        title: "Missing Input",
        description: "Please upload the garment image.",
      });
      return false;
    }
    if (!modelImgUrl) {
      toast({
        variant: "destructive",
        title: "Missing Input",
        description: "Please upload the model image.",
      });
      return false;
    }
    return true;
  };

  // Handle generate button click
  const handleGenerate = async () => {
    if (!validateInputs()) return;
    let payNow = false;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          garmentType,
          garmentImgUrl,
          modelImgUrl,
          numImages: parseInt(numImages),
        }),
      });

      if (!response.ok) {
        console.log(response);
        console.log(response.status, typeof response.status);

        if (response.status == 403) payNow = true;
        const errorMessage =
          (await response.json()).error || "Generation Failed";
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setJobId(data.job_id);
      setJobStatus(data.status);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Generation failed";
      console.log(error);

      if (payNow) {
        toast({
          title: "Generation Failed",
          description: errorMessage,
          action: (
            <ToastAction altText="Try again">
              <Link href={"/#pricing"}>Pay Now</Link>
            </ToastAction>
          ),
          variant: "destructive",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Generation Failed",
          description: errorMessage,
        });
      }

      setError(errorMessage);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkStatus = async () => {
      if (!jobId) return;

      try {
        const response = await fetch(`/api/status?jobId=${jobId}`);

        if (!response.ok) {
          throw new Error(`Status check failed: ${response.statusText}`);
        }

        const data = await response.json();
        setJobStatus(data.status);

        if (data.status === "completed" && data.imageUrl) {
          setGenImage(data.imageUrl);
          clearInterval(intervalId);
          setIsLoading(false);
          toast({
            title: "Success",
            description: "Image generated successfully!",
          });
        } else if (data.status === "failed") {
          setIsLoading(false);
          setError("Image generation failed");
          clearInterval(intervalId);
          toast({
            variant: "destructive",
            title: "Generation Failed",
            description: "Failed to generate image. Please try again.",
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to check status";
        setError(errorMessage);
        setIsLoading(false);
        clearInterval(intervalId);
        toast({
          variant: "destructive",
          title: "Status Check Failed",
          description: errorMessage,
        });
      }
    };

    if (jobId && jobStatus !== "completed" && jobStatus !== "failed") {
      intervalId = setInterval(checkStatus, 5000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobId, jobStatus]);

  return (
    <div className="mx-auto my-32 flex max-w-screen-lg flex-wrap justify-center gap-4 px-4 md:flex-nowrap md:justify-between">
      {/* Garment Section */}
      <div className="w-full sm:w-[48%] md:w-[31%]">
        <p className="font-sans font-medium md:h-12 lg:h-auto">
          Please upload or select a garment:
        </p>
        <Label htmlFor="garment" className="mt-2 hover:cursor-pointer">
          <div className="mt-2 flex h-[26rem] flex-col items-center justify-center gap-2 rounded-lg border bg-white font-sans font-bold dark:bg-gray-900/80">
            {garmentImgUrl ? (
              <Image
                width={100}
                height={100}
                alt="Garment"
                src={garmentImgUrl}
                className="h-full w-full object-contain"
                quality={100}
                unoptimized
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 p-2 text-xs">
                <ImageIcon />
                <p className="text-center">
                  Input Garment Would be displayed here.
                </p>
              </div>
            )}
          </div>
        </Label>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFileUpload(file, setGarmentImgUrl);
            }
          }}
          id="garment"
          className="hidden"
        />

        <Label htmlFor="garment_type" className="mt-2 hover:cursor-pointer">
          <Select onValueChange={(value) => setGarmentType(value)}>
            <SelectTrigger className="mt-4 w-full font-sans focus:ring-gray-300">
              <SelectValue
                placeholder="Please select a garment type"
                className="md:w-[31%]"
              />
            </SelectTrigger>
            <SelectContent className="font-sans">
              <SelectItem value="Top">Top</SelectItem>
              <SelectItem value="Bottom">Bottom</SelectItem>
              <SelectItem value="Full body">Full Body</SelectItem>
            </SelectContent>
          </Select>
        </Label>

        <ImageGallery images={garmentImages} setImgUrl={setGarmentImgUrl} />
      </div>

      {/* Model Section */}
      <div className="w-full sm:w-[48%] md:w-[31%]">
        <p className="font-sans font-medium md:h-12 lg:h-auto">
          Please upload or select a model:
        </p>
        <Label htmlFor="model" className="mt-2 hover:cursor-pointer">
          <div className="mt-2 flex h-[26rem] flex-col items-center justify-center gap-2 rounded-lg border bg-white font-sans font-bold dark:bg-gray-900/80">
            {modelImgUrl ? (
              <Image
                unoptimized
                width={100}
                height={100}
                alt="Model"
                src={modelImgUrl}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 p-2 text-xs">
                <ImageIcon />
                <p className="text-center">
                  Input Model will be displayed here.
                </p>
              </div>
            )}
          </div>
        </Label>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFileUpload(file, setModelImgUrl);
            }
          }}
          id="model"
          className="hidden"
        />

        <div className="mt-16">
          <ImageGallery images={modelImages} setImgUrl={setModelImgUrl} />
        </div>
      </div>

      {/* Generated Image Section */}
      <div className="w-full sm:max-w-80 md:w-[31%]">
        <p className="font-sans font-medium md:h-12 lg:h-auto">
          Generated image:
        </p>

        <div className="mt-2 flex h-[26rem] flex-col items-center justify-center gap-2 rounded-lg border bg-white font-sans font-bold dark:bg-gray-900/80">
          {genImageUrl ? (
            <Image
              unoptimized
              width={100}
              height={100}
              alt="Generated Image"
              src={genImageUrl}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 p-2 text-xs">
              <ImageIcon />
              <p className="text-center">
                Generated image will be displayed here.
              </p>
            </div>
          )}
        </div>

        {/* <div className="mt-4 flex items-center gap-2">
            <Label
              htmlFor="num_images"
              className="w-full font-sans text-sm hover:cursor-pointer"
            >
              Number of images:
            </Label>
            <Select
              defaultValue="1"
              onValueChange={(value) => setNumImages(value)}
            >
              <SelectTrigger className="font-sans focus:ring-gray-300">
                <SelectValue className="md:w-[31%]" />
              </SelectTrigger>
              <SelectContent className="font-sans">
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </div> */}
        <div>
          <Button
            className="mt-4 w-full"
            variant={"outline"}
            onClick={() => {
              if (!garmentType && !garmentImgUrl && !modelImgUrl) {
                const message = !garmentType
                  ? "Please select the garment type."
                  : !garmentImgUrl
                    ? "Please upload the garment image."
                    : "Please upload the model image.";
                toast({
                  variant: "destructive",
                  title: "Uh oh! Something went wrong.",
                  description: message,
                });
                return;
              }
              handleGenerate();
            }}
            disabled={
              isLoading || !garmentType || !garmentImgUrl || !modelImgUrl
            }
          >
            {isLoading ? "Processing..." : "Generate Model"}
          </Button>
        </div>
      </div>
    </div>
  );
}
