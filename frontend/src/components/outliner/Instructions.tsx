import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";

const tib = "[font-family:jomo,sans-serif] text-[15px] leading-loose text-foreground";

function Section({
  title,
  titleEn,
  children,
  className,
}: Readonly<{
  title: string;
  titleEn: string;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="border-b border-border pb-2">
        <h2 className={cn(tib, "text-lg font-medium tracking-tight")}>{title}</h2>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{titleEn}</p>
      </div>
      {children}
    </section>
  );
}

function Subheading({ tibetan, english }: Readonly<{ tibetan: string; english: string }>) {
  return (
    <div className="pt-2">
      <h3 className={cn(tib, "text-base font-medium text-foreground")}>{tibetan}</h3>
      <p className="text-sm font-medium text-muted-foreground">{english}</p>
    </div>
  );
}

function Guideline({
  tibetan,
  englishTitle,
  englishBody,
}: Readonly<{
  tibetan: string;
  englishTitle?: string;
  englishBody: ReactNode;
}>) {
  return (
    <li className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3 shadow-sm dark:bg-muted/15">
      <p className={tib}>{tibetan}</p>
      <div className="mt-3 border-t border-border/50 pt-3 text-sm leading-relaxed text-muted-foreground">
        {englishTitle ? (
          <p className="mb-1.5 font-semibold text-foreground/90">{englishTitle}</p>
        ) : null}
        {englishBody}
      </div>
    </li>
  );
}

function InstructionsBody() {
  return (
    <div className="space-y-10 pb-6">
      <header className="space-y-3">
        <h1 className={cn(tib, "text-xl font-semibold tracking-tight text-foreground")}>
          ལམ་སྟོན་ཡིག་ཆ།
        </h1>
        <p className={tib}>
          ལས་གཞི་འདི་ནི་ tools བརྒྱུད་དེ་དཔེ་དེབ་གང་རུང་ཞིག་གི་ནང་གསེས་ཀྱི་སྡེ་ཚན་སོ་སོར་ཕྱེས་ཏེ་མཚན་བྱང་དང་རྩོམ་པ་པོ་གསལ་བར་ལེགས་པར་བཀོད་དགོས་པའི་ལས་གཞི་ཞིག་ཡིན།
          ལས་གཞི་འདི་ལེགས་པར་གྲུབ་རྗེས་AI བེད་སྤྱོད་ཀྱིས་བོད་ཀྱི་སྐད་ཡིག་བེད་སྤྱོད་གཏོང་མཁན་ལ་སྟབས་བདེ་དང་མྱུར་མོའི་ལམ་ནས་ཡིག་ཆ་ཚད་ལྡན་རག་ཐུབ་པས་ལས་གཞི་གལ་ཆེན་ཞིག་ཡིན།
        </p>
        <div className="rounded-md border border-border/60 bg-background px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Annotation guidelines
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Overview.</span> This project involves using
            tools to split any book into its individual sections, with clear and proper labeling of
            titles and authors. Once completed, this project is important because it allows Tibetan
            language users to access quality documents quickly and conveniently through AI.
          </p>
        </div>
      </header>

      <Section title="ཀ༽ ལས་ཀ་བྱེད་མཁན་གྱིས་ལག་བསྟར་བྱེད་དགོས་པ་ཁག" titleEn="Annotator instructions">
        <ul className="list-none space-y-3">
          <Guideline
            tibetan="དཔེ་དེབ་གང་ཞིག་གི་དཀར་ཆག་སྔོན་གྱི་སྡེ་ཚན་གང་ཡོད་སྡེ་ཚན་གཅིག་ཏུ་གཏུབ་སྟེ་Front matter བདམས་ཏེ་ N/A མནན་དགོས།"
            englishTitle="Front matter"
            englishBody={
              <p>
                Merge all sections appearing before the table of contents into one chunk, select{" "}
                <strong>Front matter</strong>, press <strong>N/A</strong>.
              </p>
            }
          />
          <Guideline
            tibetan="དཀར་ཆག་ལོགས་སུ་གཏུབ་ནས་TOC བདམས་ཏེ་ N/A མནན་ནས་ཉར་ཚགས་བྱེད་དགོས།"
            englishTitle="TOC (table of contents)"
            englishBody={
              <p>
                Split the table of contents separately, select <strong>TOC</strong>, press{" "}
                <strong>N/A</strong>.
              </p>
            }
          />
          <Guideline
            tibetan="གཞུང་དངོས་ཀྱི་ཆོས་ཚན་རེ་རེ་གཏུབ་ནས་Text བདམས་ཏེ་གཞུང་གི་མཚན་བྱང་ཡིག་རྐྱང་གཞིར་བཟུང་སྟེ་དག་ཆ་མ་ནོར་བ་དང་བར་སྟོང་སོགས་མེད་པར་ Title ནང་བཀོད་དགོས། རྩོམ་པ་པོའི་མཚན་ལེགས་པར་ངོས་འཛིན་གྱིས་ Author Name in the text ནང་ཉར་ཚགས་བྱེད་དགོས།"
            englishTitle="Text (main body)"
            englishBody={
              <ul className="list-disc space-y-2 pl-4 marker:text-primary">
                <li>
                  Split each chapter or section of the main text individually, select{" "}
                  <strong>Text</strong>.
                </li>
                <li>
                  Enter the title in the <strong>Title</strong> field based on the exact text of the
                  section heading, with no spelling errors and no extra spaces.
                </li>
                <li>
                  Identify the author correctly and save under{" "}
                  <strong>Author name in the text.</strong>
                </li>
              </ul>
            }
          />
        </ul>

        <Subheading tibetan="དང་པོ། མཚན་བྱང་གི་སྐོར།" english="Titles" />

        <ul className="mt-3 list-none space-y-3">
          <Guideline
            tibetan="གཏུབ་ཟིན་པའི་ཆོས་ཚན་གང་རུང་ཞིག་ལ་མཚན་བྱང་མེད་ན་མཇུག་ཏུ་ཡོད་མེད་ཞིབ་གཟིགས་ཀྱིས་མཇུག་ཏུ་གསལ་ན་དེ་མཚན་བྱང་དུ་བཀོད་དགོས།"
            englishTitle="If a split text section has no title"
            englishBody={
              <p>
                Check the end of the section — if a title appears there, use it as the title.
              </p>
            }
          />
          <Guideline
            tibetan="མཚན་བྱང་མེད་པ་གང་ཞིག་ལ་མཇུག་ཏུའང་མི་གསལ་ན་སྐུལ་བ་པོ་དང་དུས་ཚོད། ས་གནས་སོགས་ཡོད་ན་དེ་དག་དང་སྦྱར་ནས་མིང་གསར་པ་བཟོ་དགོས། དཔེར་ན་བཀྲ་ཤིས་ཀྱིས་བསྐུལ་ངོར་མཛད་པའོ།། ལྟ་བུ་གསལ་ན་སྡེ་ཚན་བསྟོད་པ་དང་། སྨོན་ལམ་སོགས་གང་ཡིན་དང་སྦྱར་ཏེ་བཀྲ་ཤིས་ཀྱིས་བསྐུལ་ངོར་སྦྱར་བའི་བསྟོད་པ། ལྟ་བུ་བཟོ་དགོས།"
            englishTitle="If there is no title anywhere in the section"
            englishBody={
              <p>
                If there is a requester’s name, date, and location mentioned, combine them to create a
                new title. Example: if it says &quot;composed at the request of Tashi&quot;, create a
                title like: &quot;Praise composed at the request of Tashi&quot;.
              </p>
            }
          />
          <Guideline
            tibetan="གོང་གི་དེ་དག་གང་ཡང་མི་གསལ་ན་སྡེ་ཚན་དང་དོན་དུ་གཞིགས་ཏེ་བཅད་ཟིན་པའི་ཆོས་ཚན་གྱི་དབུའི་ཚེག་ཁྱིམ་གཉིས་གསུམ་གང་རུང་དང་སྦྱར་ཏེ་འབྲི་དགོས། དཔེར་ན། ཞབས་བརྟན་རབ་འབྱམས་མ། ལྟ་བུ་བྲིས་ཆོག"
            englishTitle="If none of the above are available"
            englishBody={
              <p>
                Based on the meaning of the text, take the first 2–3 syllables of the section text and
                use that as the title. Example: &quot;ཞབས་བརྟན་རབ་འབྱམས་མ།&quot;.
              </p>
            }
          />
          <Guideline
            tibetan="གལ་སྲིད་ཆོས་ཚན་གྱི་མཚན་བྱང་དེ་གཞུང་གི་ཡིག་རྐྱང་དུ་མི་གསལ་བར་དེབ་ཀྱི་རྒྱབ་ཤོག་དང་བདམས་ཟིན་པའི་Front matter ནང་དུ་གསལ་ན་མཚན་བྱང་དེ་བྲིས་ནས་ reconstructed འདི་ལ་འགྲིག་རྟགས་བཀོད་དགོས།"
            englishTitle="If the title is not in the main text"
            englishBody={
              <p>
                If it appears on the book&apos;s cover or in the previously selected{" "}
                <strong>Front matter</strong>, write that title and mark the{" "}
                <strong>reconstructed</strong> checkbox.
              </p>
            }
          />
          <Guideline
            tibetan="གལ་ཏེ་དཀར་ཆག་གི་རྗེས་དང། ཆོས་ཚན་གང་ཞིག་གི་མགོ་མཇུག་གཉིས་སུ་མཛད་པ་པོའི་ངོ་སྤྲོད་མདོར་བསྡུས་དང་། བསྡུས་དོན། དཔར་སྐྲུན་གླེང་བརྗོད་སོགས་གསལ་ན་མཛད་པ་པོའི་ཚབ་ཏུ་མཚན་དེ་ཉིད་སྦྱར་ཏེ་འབྲི་དགོས། དཔེར་ན་ཆོས་ཚན་དེའི་མཛད་པ་པོ་རྒྱལ་སྲས་ཞི་བ་ལྷ་ཡིན་ན། རྒྱལ་སྲས་ཞི་བ་ལྷ་ངོ་སྤྲོད་མདོར་བསྡུས། ལྟ་བུ་དང་། དེབ་ཀྱི་མཚན་བྱང་དུ་བྱང་ཆུབ་སེམས་དཔའི་སྤྱོད་པ་ལ་འཇུག་པ་ཡིན་ན་བྱང་ཆུབ་སེམས་དཔའི་སྤྱོད་པ་ལ་འཇུག་པའི་བསྡུས་དོན་ལྟ་བུ་སྦྱར་ནས་འབྲི་དགོས།"
            englishTitle="Author introduction, summary, or publishing note"
            englishBody={
              <p>
                If there is a brief author introduction, summary, or publishing note at the beginning or
                end of a section or after the TOC, combine the author&apos;s name with the section type
                to form the title. Example: if the author is རྒྱལ་སྲས་ཞི་བ་ལྷ།, write རྒྱལ་སྲས་ཞི་བ་ལྷ་ངོ་སྤྲོད་མདོར་བསྡུས།. If the book title is བྱང་ཆུབ་སེམས་དཔའི་སྤྱོད་པ་ལ་འཇུག་པ།, write བྱང་ཆུབ་སེམས་དཔའི་སྤྱོད་པ་ལ་འཇུག་པའི་བསྡུས་དོན།.
              </p>
            }
          />
          <Guideline
            tibetan="མཚན་བྱང་གོང་བཀོད་དེ་དག་ལྟར་བཟོས་རྗེས་ངེས་པར་དུ་reconstructed འདི་ལ་འགྲིག་རྟགས་བཀོད་དགོས། འགྲིག་རྟགས་བཀོད་པའི་དོན་ནི་བཟོ་བཞིན་པའི་གཞུང་གི་ཡིག་རྐྱང་དུ་མི་གསལ་བ་དང་མཛད་པ་པོའི་བཏགས་པ་མ་ཡིན་པར་ཁྱོད་ཀྱིས་མཚན་བྱང་གསར་དུ་བཟོས་པའི་དོན་ཡིན།"
            englishTitle="Important: reconstructed titles"
            englishBody={
              <p>
                Whenever you construct or create a title (not directly from the text), you must check the{" "}
                <strong>reconstructed</strong> box. This indicates the title was not in the original
                text and was created by you.
              </p>
            }
          />
          <Guideline
            tibetan="ཆོས་ཚན་རེ་རེ་གཏུབ་རྒྱུ་ལས་དེའི་ནང་གི་ལེའུ་དང་། རྟོག་པ། སྐབས། རིམ་པར་ཕྱེ་བ་སོགས་གང་ཡང་གཅོད་མི་དགོས།"
            englishTitle="What to split and what not to split"
            englishBody={
              <p>
                Split only individual texts — do <strong>not</strong> further split chapters,
                sub-sections, bampos, or sub-topics within a text.
              </p>
            }
          />
          <Guideline
            tibetan="དཀར་ཆག་ཏུ་གསལ་བའི་ཆོས་ཚན་ཁོ་ན་སོ་སོ་གཏུབ་རྒྱུ་ལས་ས་བཅད་སོགས་ལོགས་སུ་གཏུབ་མི་དགོས།"
            englishBody={
              <p>
                Split only the sections listed in the table of contents — do not separately split
                headings or outlines.
              </p>
            }
          />
          <Guideline
            tibetan="དཀར་ཆག་ཏུ་མི་གསལ་ཡང་གསུང་ཐོར་བུ་ལྟ་བུ་དང་བསྟོད་པ་སོགས་ཕྱོགས་བསྒྲིགས་ལྟ་བུ་ཡིན་ན་དེའི་ནང་གི་ཆོས་ཚན་གྱི་རིང་ཐུང་ལ་མ་ལྟོས་པར་ངེས་པར་གཏུབ་དགོས།"
            englishTitle="Sections not in the TOC"
            englishBody={
              <p>
                If a section is not in the TOC but appears to be a collection (like miscellaneous
                writings or praises and hymns), split each piece within it individually, regardless of
                length.
              </p>
            }
          />
          <Guideline
            tibetan="མཚན་བྱང་གི་མཐར་ཞེས་བྱ་བ་བཞུགས་སོ།། ཅེས་བྱ་བ་བཞུགས་སོ།། བཞུགས་སོ།། ལྟ་བུ་མི་དགོས་པར་མཚན་བྱང་རང་གི་མཇུག་ཏུ་ཤད་ངེས་པར་འགོད་དགོས།"
            englishTitle="Title endings"
            englishBody={
              <p>
                Do <strong>not</strong> add endings like &quot;ཞེས་བྱ་བ་བཞུགས་སོ།&quot; or
                &quot;བཞུགས་སོ&quot; to the title. The title should simply end with a shad (།).
              </p>
            }
          />
          <Guideline
            tibetan="མཇུག་ཏུ་དེབ་ཀྱི་དཔར་བྱང་སྨོན་ཚིག་སོགས་གཏུབ་སྟེ་Back matter ནང་བདམས་ཏེ་N/A མནན་ནས་ཉར་ཚགས་བྱེད་དགོས།"
            englishTitle="Back matter"
            englishBody={
              <p>
                At the end, split the colophon, dedication prayers, and similar material, select{" "}
                <strong>Back matter</strong>, press <strong>N/A</strong>.
              </p>
            }
          />
          <Guideline
            tibetan="ཁྱེད་ཀྱིས་གོང་གི་འདི་དག་ལེགས་པར་བཟོས་རྗེས་Submit བྱེད་དགོས།"
            englishBody={
              <p>
                Once all of the above is done, click <strong>Submit</strong>.
              </p>
            }
          />
          <Guideline
            tibetan="གལ་ཏེ་དེབ་ཀྱི་མ་ཡིག་གི་བཤེར་དཔར་དེ་གསལ་པོ་མེད་པ་དང་། ཡིག་གཟུགས་ཀྱི་ཁྱད་པར་སོགས་ཀྱིས་ཡིག་རྐྱང་དེ་ཉིད་ནོར་འཁྲུལ་མང་དྲགས་ཏེ་གཏུབ་རྒྱུ་ཧ་ཅང་དཀའ་ན་ Skip བྱེད་ཆོག"
            englishTitle="When to skip"
            englishBody={
              <p>
                If the original scan of the book is unclear, or font variations make the text too
                difficult to read with too many errors, you may click <strong>Skip</strong>.
              </p>
            }
          />
        </ul>
      </Section>

      <Section title="གཉིས་པ། མཛད་པ་པོའི་སྐོར།" titleEn="About author names">
        <ul className="list-none space-y-3">
          <Guideline
            tibetan="གཏུབ་ཟིན་པའི་ཆོས་ཚན་གྱི་མགོ་མཇུག་གང་དུ་མཛད་པ་པོའི་མཚན་གསལ་ན་དེ་རང་རྩོམ་པ་པོར་བདམས་ཏེ་ཉར་ཚགས་བྱེད་དགོས།"
            englishBody={
              <p>
                If the author&apos;s name appears anywhere in the split section (beginning or end),
                select it as the author name and save.
              </p>
            }
          />
          <Guideline
            tibetan="རྩོམ་པ་པོའི་མཚན་དེ་ཆོས་ཚན་གྱི་ཡིག་རྐྱང་དུ་གསལ་ན་ཐོབ་མིང་དང་རྒྱན་ཚིག་གང་ཡོད་ཀྱང་བྲིས་ཆོག་ལ་ཐོབ་མིང་སོགས་མ་བྲིས་པར་མཚན་དངོས་བྲིས་ཆོག"
            englishBody={
              <p>
                You may write the full name with titles and honorifics, or just the personal name —
                both are acceptable.
              </p>
            }
          />
          <Guideline
            tibetan="གཏུབ་ཟིན་པའི་ཆོས་ཚན་གྱི་ཡིག་རྐྱང་དུ་མཛད་པ་པོའི་མཚན་མི་གསལ་ན་ངེས་པར་སྟོང་པ་འཇོག་དགོས།"
            englishBody={
              <p>
                If the author&apos;s name does not appear anywhere in the split section, leave the
                author field blank.
              </p>
            }
          />
        </ul>

        <p className={cn(tib, "mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[14px]")}>
          གོང་བཀོད་ཀྱི་འདི་དག་རེ་རེ་ནས་ནོར་འཁྲུལ་གྱིས་ལས་ཀ་བྱས་ན་བསྐྱར་ཞིབ་སྡེ་ཚན་གྱིས་reject
          བྱེད་པ་དང་། ནོར་འཁྲུལ་ཆུང་རིགས་བསྐྱར་ཞིབ་པས་བཟོ་བཅོས་བྱེད་ངེས་མོད། གང་བྱས་ཀྱང་ཐོབ་དངུལ་ལས་གཅོག་ཆ་བྱེད་ངེས་སོ།།
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Any errors in the above tasks will result in the review team rejecting the work. Minor errors
          may be corrected by the reviewer, but in either case, deductions will be made from payment.
        </p>
      </Section>

      <Section title="བསྐྱར་ཞིབ་སྡེ་ཚན།" titleEn="Reviewer instructions">
        <p className={tib}>
          {"གོང་གི་ལས་ཀ་བྱེད་མཁན་གྱི་ལས་རིམ་འདི་དག་གཞི་ལ་བཞག་སྟེ། སྡེ་ཚན་རེ་རེ་བཞིན་ཏག་ཏག་"}
          <strong className="font-semibold">གཏུབ་</strong>
          {"མིན་དང་། ཚན་པ་དེ་དག་ངོས་འཛིན་"}
          <strong className="font-semibold">འགྲིག་པར་བྱས་</strong>
          {"མིན། དེ་བཞིན་"}
          <strong className="font-semibold">མཚན་བྱང་</strong>
          {"དང་རྩོམ་པ་པོའི་"}
          <strong className="font-semibold">མཚན་</strong>
          {"རྣམས་འགྲིག་མིན་ཞིབ་ནན་གྱིས་བསྐྱར་ཞིབ་བྱེད་དགོས།"}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Based on the annotator guidelines above, reviewers must carefully check each section to verify
          it has been split correctly, the section types have been identified properly, and the titles
          and author names are accurate.
        </p>
      </Section>

      <footer className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">གསལ་བཤད། · Note</p>
        <p className={cn(tib, "mt-2 text-[14px]")}>
          རྗེས་སུ་འདིའི་ནང་དུ་མ་ཚུད་པའི་དཀའ་ངལ་གཞན་དག་འབྱུང་ཚེ་དུས་ནས་དུས་སུ་ཁ་སྣོན་བྱས་ཏེ་འགྲེལ་བཤད་བྱེད་ཆོག་པར་ཞུ།
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          If additional issues arise that are not covered in these guidelines, explanations may be added
          from time to time as updates.
        </p>
      </footer>
    </div>
  );
}

function InstructionsDrawer() {
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setInstructionsOpen(true)} title="Instructions">
        Instructions
      </Button>
      <Drawer open={instructionsOpen} onOpenChange={setInstructionsOpen} direction="right">
        <DrawerContent className="data-[vaul-drawer-direction=right]:w-[90vw] data-[vaul-drawer-direction=right]:sm:max-w-2xl">
          <DrawerHeader className="flex flex-row items-center justify-between gap-3 border-b">
            <DrawerTitle>Instructions</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="outline" size="sm">
                Close
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <InstructionsBody />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export default InstructionsDrawer;
