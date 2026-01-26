import type { Content } from "@radix-ui/react-popover"
import { XIcon } from "lucide-react"
import { Link } from "react-router-dom"
import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
} from "@/components/ui/popover"
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer"
import { useLanguage } from "@/contexts/LanguageContext"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { Filter, Settings, Upload, Users, Wrench } from "lucide-react"

function renderGuideContent(content: string, t: ReturnType<typeof useLanguage>["t"]) {
    const parts = content.split(/({[^}]+})/g);
    
    return (
        <span>
            {parts.map((part, index) => {
                const match = part.match(/{([^}]+)}/);
                if (match) {
                    const key = match[1];
                    let icon = null;
                    let label = "";

                    switch (key) {
                        case "import":
                            icon = <Upload className="size-3.5 mr-1" />;
                            label = t.ui("app.import");
                            break;
                        case "customize":
                            icon = <Wrench className="size-3.5 mr-1" />;
                            label = t.ui("buttons.customize");
                            break;
                        case "weights":
                            icon = <Settings className="size-3.5 mr-1" />;
                            label = t.ui("accountData.statWeights");
                            break;
                        case "builds":
                            icon = <Settings className="size-3.5 mr-1" />;
                            label = t.ui("navigation.configure"); // Character Builds
                            break;
                        case "filters":
                            icon = <Filter className="size-3.5 mr-1" />;
                            label = t.ui("navigation.computeFilters"); // Artifact Filters
                            break;
                        case "characters":
                            icon = <Users className="size-3.5 mr-1" />;
                            label = t.ui("accountData.characters");
                            break;
                        default:
                            return part;
                    }

                    return (
                        <span key={index} className="inline-flex items-center mx-1 font-medium text-foreground bg-muted px-1.5 py-0.5 rounded-md border text-sm align-baseline transform translate-y-[2px]">
                            {icon}
                            {label}
                        </span>
                    );
                }
                return part;
            })}
        </span>
    );
}

const TourContext = React.createContext<{
    start: (tourId: string) => void
    close: () => void
} | null>(null)

function useTour() {
    const context = React.useContext(TourContext)
    if (!context) {
        throw new Error("useTour must be used within a TourProvider")
    }
    return context
}

interface Step {
    id: string
    title: React.ReactNode
    content: React.ReactNode
    nextRoute?: string
    previousRoute?: string
    nextLabel?: React.ReactNode
    previousLabel?: React.ReactNode
    side?: React.ComponentProps<typeof Content>["side"]
    sideOffset?: React.ComponentProps<typeof Content>["sideOffset"]
    align?: React.ComponentProps<typeof Content>["align"]
    alignOffset?: React.ComponentProps<typeof Content>["alignOffset"]
    className?: string
}

interface Tour {
    id: string
    steps: Step[]
    guideContent?: string
}

function TourProvider({
    tours,
    children,
}: {
    tours: Tour[]
    children: React.ReactNode
}) {
    const { t } = useLanguage()
    const [isOpen, setIsOpen] = React.useState(false) // Desktop Tour State
    const [activeTourId, setActiveTourId] = React.useState<string | null>(null)
    const [currentStepIndex, setCurrentStepIndex] = React.useState(0)

    // Mobile Guide State
    const [isGuideOpen, setIsGuideOpen] = React.useState(false)
    const [activeGuideId, setActiveGuideId] = React.useState<string | null>(null)

    const isDesktop = useMediaQuery("(min-width: 1024px)")

    const activeTour = tours.find((tour) => tour.id === activeTourId)
    const activeGuide = tours.find((tour) => tour.id === activeGuideId)
    const steps = activeTour?.steps || []

    function next() {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex((prev) => prev + 1)
        } else {
            setIsOpen(false)
            setCurrentStepIndex(0)
            setActiveTourId(null)
        }
    }

    function previous() {
        if (currentStepIndex > 0) {
            setCurrentStepIndex((prev) => prev - 1)
        }
    }

    function close() {
        setIsOpen(false)
        setCurrentStepIndex(0)
        setActiveTourId(null)
        
        setIsGuideOpen(false)
        setActiveGuideId(null)
    }

    function start(tourId: string) {
        const tour = tours.find((tour) => tour.id === tourId)
        if (tour) {
            if (isDesktop) {
                // Desktop: Start Tour
                if (tour.steps.length > 0) {
                    setActiveTourId(tourId)
                    setIsOpen(true)
                    setCurrentStepIndex(0)
                } else {
                    console.error(`Tour with id '${tourId}' has no steps.`)
                }
            } else {
                // Mobile: Open Guide Drawer
                setActiveGuideId(tourId)
                setIsGuideOpen(true)
            }
        } else {
            console.error(`Tour with id '${tourId}' not found.`)
        }
    }

    return (
        <TourContext.Provider
            value={{
                start,
                close,
            }}>
            {children}
            
            {/* Desktop Tour Overlay */}
            {isDesktop && isOpen && activeTour && steps.length > 0 && (
                <TourOverlay
                    step={steps[currentStepIndex]}
                    currentStepIndex={currentStepIndex}
                    totalSteps={steps.length}
                    onNext={next}
                    onPrevious={previous}
                    onClose={close}
                />
            )}

            {/* Mobile Guide Drawer */}
            {!isDesktop && activeGuide && (
                <Drawer open={isGuideOpen} onOpenChange={setIsGuideOpen}>
                    <DrawerContent>
                        <DrawerHeader>
                            <DrawerTitle>{t.ui("tour.guide.title")}</DrawerTitle>
                            <DrawerDescription className="whitespace-pre-line text-left pt-4 text-base">
                                {activeGuide.guideContent ? renderGuideContent(activeGuide.guideContent, t) : "No guide content available."}
                            </DrawerDescription>
                        </DrawerHeader>
                        <DrawerFooter>
                            <Button onClick={() => setIsGuideOpen(false)}>{t.ui("tour.guide.gotIt")}</Button>
                        </DrawerFooter>
                    </DrawerContent>
                </Drawer>
            )}
        </TourContext.Provider>
    )
}

function TourOverlay({
    step,
    currentStepIndex,
    totalSteps,
    onNext,
    onPrevious,
    onClose,
}: {
    step: Step
    currentStepIndex: number
    totalSteps: number
    onNext: () => void
    onPrevious: () => void
    onClose: () => void
}) {
    const [targets, setTargets] = React.useState<
        { rect: DOMRect; radius: number }[]
    >([])

    React.useEffect(() => {
        let needsScroll = true

        function updatePosition() {
            const elements = document.querySelectorAll(
                `[data-tour-step-id*='${step.id}']`
            )

            if (elements.length > 0) {
                const validElements: {
                    rect: {
                        width: number
                        height: number
                        x: number
                        y: number
                        left: number
                        top: number
                        right: number
                        bottom: number
                        toJSON: () => void
                    }
                    radius: number
                    element: Element
                }[] = []

                Array.from(elements).forEach((element) => {
                    const rect = element.getBoundingClientRect()
                    if (rect.width === 0 && rect.height === 0) return

                    const style = window.getComputedStyle(element)
                    const radius = Number(style.borderRadius) || 4

                    validElements.push({
                        rect: {
                            width: rect.width,
                            height: rect.height,
                            x: rect.left,
                            y: rect.top,
                            left: rect.left,
                            top: rect.top,
                            right: rect.right,
                            bottom: rect.bottom,
                            toJSON: () => {},
                        },
                        radius,
                        element,
                    })
                })

                setTargets(
                    validElements.map(({ rect, radius }) => ({ rect, radius }))
                )

                if (validElements.length > 0 && needsScroll) {
                    validElements[0].element.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    })
                    needsScroll = false
                }
            } else {
                setTargets([])
            }
        }

        updatePosition()
        const handleResizeOrScroll = () => updatePosition()

        window.addEventListener("resize", handleResizeOrScroll)
        window.addEventListener("scroll", handleResizeOrScroll, true)

        const observer = new MutationObserver(() => updatePosition())
        observer.observe(document.body, {
            attributes: true,
            childList: true,
            subtree: true,
        })

        const resizeObserver = new ResizeObserver(() => updatePosition())
        resizeObserver.observe(document.body)

        return () => {
            window.removeEventListener("resize", handleResizeOrScroll)
            window.removeEventListener("scroll", handleResizeOrScroll, true)
            observer.disconnect()
            resizeObserver.disconnect()
        }
    }, [step])

    React.useEffect(() => {
        document.body.style.overflow = "hidden"
        return () => {
            document.body.style.overflow = ""
        }
    }, [])

    if (!document) return null
    if (targets.length === 0) return null

    return createPortal(
        <div className="fixed inset-0 z-[100]">
            <svg className="absolute inset-0 size-full">
                <defs>
                    <mask id="tour-mask">
                        <rect
                            x="0"
                            y="0"
                            width="100%"
                            height="100%"
                            fill="white"
                        />
                        {targets.map((target, i) => (
                            <rect
                                key={i}
                                x={target.rect.left}
                                y={target.rect.top}
                                width={target.rect.width}
                                height={target.rect.height}
                                rx={target.radius}
                                fill="black"
                            />
                        ))}
                    </mask>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    mask="url(#tour-mask)"
                    className="fill-black opacity-20"
                />
                {targets.map((target, i) => {
                    return (
                        <rect
                            key={i}
                            x={target.rect.left}
                            y={target.rect.top}
                            width={target.rect.width}
                            height={target.rect.height}
                            rx={target.radius}
                            className="stroke-primary fill-none stroke-2"
                        />
                    )
                })}
            </svg>
            {targets.length > 0 && (
                <Popover key={step.id} open={true}>
                    <PopoverAnchor
                        virtualRef={{
                            current: {
                                getBoundingClientRect: () =>
                                    targets[0]?.rect || {
                                        top: 0,
                                        left: 0,
                                        width: 0,
                                        height: 0,
                                        bottom: 0,
                                        right: 0,
                                        x: 0,
                                        y: 0,
                                        toJSON: () => {},
                                    },
                            },
                        }}
                    />
                    <PopoverContent
                        className={cn("p-0 z-[101]", step.className)}
                        side={step.side}
                        sideOffset={step.sideOffset ?? 12}
                        align={step.align}
                        alignOffset={step.alignOffset}
                        collisionPadding={16}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        onCloseAutoFocus={(e) => e.preventDefault()}>
                        <div className="relative rounded-xl border bg-card text-card-foreground shadow">
                            {/* Close button - top right corner */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 size-7"
                                onClick={onClose}>
                                <XIcon className="size-4" />
                            </Button>

                            {/* Header */}
                            <div className="p-4 pr-10 pb-2">
                                <div className="font-semibold leading-none tracking-tight">
                                    {step.title}
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                    Step {currentStepIndex + 1} of {totalSteps}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="px-4 pb-2 text-sm">
                                {step.content}
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between gap-2 p-4 pt-2">
                                {currentStepIndex > 0 ? (
                                    step.previousRoute ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={onPrevious}
                                            asChild>
                                            <Link to={step.previousRoute}>
                                                {step.previousLabel ??
                                                    "Previous"}
                                            </Link>
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={onPrevious}>
                                            {step.previousLabel ?? "Previous"}
                                        </Button>
                                    )
                                ) : (
                                    <div />
                                )}
                                {step.nextRoute ? (
                                    <Button
                                        size="sm"
                                        onClick={onNext}
                                        asChild>
                                        <Link to={step.nextRoute}>
                                            {step.nextLabel ??
                                                (currentStepIndex ===
                                                totalSteps - 1
                                                    ? "Finish"
                                                    : "Next")}
                                        </Link>
                                    </Button>
                                ) : (
                                    <Button size="sm" onClick={onNext}>
                                        {step.nextLabel ??
                                            (currentStepIndex === totalSteps - 1
                                                ? "Finish"
                                                : "Next")}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>,
        document.body
    )
}

export { TourProvider, useTour, type Step, type Tour }
