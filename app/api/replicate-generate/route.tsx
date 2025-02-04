import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { reduceUserCredits } from "@/utils/db/actions";
import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

export const maxDuration = 60;

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(req: NextRequest) {
  try {
    const { prompt, cameraAngle } = await req.json();
    console.log(prompt, cameraAngle);
    // Validate inputs
    if (!cameraAngle || !prompt) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    const session = await auth();
    const user = await prisma.user.findUnique({
      where: { email: session?.user?.email! },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Please login to continue" },
        { status: 401 },
      );
    } else if (!(user?.totalCredits > 0)) {
      return NextResponse.json(
        {
          error:
            "Insufficient credits. Please recharge your account to continue.",
          pay: true,
        },
        { status: 403 },
      );
    }

    // Construct detailed prompt
    const detailedPrompt = `#fashion ${prompt}, highly detailed and full-body , captured in a ${cameraAngle} view.`;

    const input = {
      cfg: 4.5,
      steps: 40,
      prompt: detailedPrompt,
      aspect_ratio: "1:1",
      output_format: "webp",
      output_quality: 90,
      prompt_strength: 0.85,
    };

    // Run Replicate model
    const output = await replicate.run(
      "stability-ai/stable-diffusion-3.5-large",
      { input },
    );

    // @ts-expect-error output has some error
    const text = await new Response(output).text();

    await reduceUserCredits({ email: user.email, reduceBy: 1 });

    return NextResponse.json({
      imageUrl: text,
      message: "Image generated successfully",
    });
  } catch (error) {
    console.log("Replicate generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate image",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
